import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type { GenerateAuthenticationOptionsOpts } from '@simplewebauthn/server';
import type { AuthenticatorTransport } from '@simplewebauthn/types';
import { strictRateLimit, authRateLimit } from '../middleware/rate-limiter';
import { BYPASS_DEV_AUTH } from 'server/middleware/auth-middleware';
import { getModlServersModel } from '../db/connectionManager';


const rpID = 'localhost';
const expectedOrigin = process.env.NODE_ENV === 'production'
  ? `https://${process.env.APP_DOMAIN}`
  : 'http://localhost:5173';

const router = Router();

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

interface EmailCodeEntry {
  code: string;
  email: string;
  expiresAt: number;
}

const emailVerificationCodes = new Map<string, EmailCodeEntry>();
const fidoChallenges = new Map<string, { challenge: string, email: string, expiresAt: number }>();
const CODE_EXPIRY_MS = 15 * 60 * 1000;
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

function generateNumericCode(length: number = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

router.get('/check-email/:email', async (req: Request<{ email: string }>, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      // In development mode, accept any email and assume no 2FA/FIDO for simplicity
      return res.json({
        exists: true,
        isTwoFactorEnabled: false, // Default to false for any dev email
        hasFidoPasskeys: false    // Default to false for any dev email
      });
    }

    const Staff = req.serverDbConnection!.model('Staff');
    const requestedEmail = req.params.email.toLowerCase(); // Normalize requested email

    const staffMember = await Staff.findOne({ email: requestedEmail });

    if (staffMember) {
      const hasFidoPasskeys = !!(staffMember.passkeys && staffMember.passkeys.length > 0);
      return res.json({
        exists: true,
        isTwoFactorEnabled: !!staffMember.isTwoFactorEnabled,
        hasFidoPasskeys: hasFidoPasskeys
      });
    }

    try {
      const ModlServer = await getModlServersModel();
      const serverConfig = await ModlServer.findOne({ serverName: req.serverName });

      if (serverConfig && serverConfig.adminEmail.toLowerCase() === requestedEmail) {
        // Main admin email for this server. Assume no 2FA/FIDO unless these are also stored in ModlServer
        return res.json({
          exists: true,
          isTwoFactorEnabled: false, // Or fetch from serverConfig if available
          hasFidoPasskeys: false     // Or fetch from serverConfig if available
        });
      }
    } catch (globalDbError) {
      console.error(`[Server: ${req.serverName}] Error fetching server config from global DB:`, globalDbError);
      // Continue to "not found" if global DB access fails, to not break login for regular staff
    }

    return res.json({ exists: false, isTwoFactorEnabled: false, hasFidoPasskeys: false });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Route to send email verification code
router.post('/send-email-code', strictRateLimit, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const code = generateNumericCode();
  const expiresAt = Date.now() + CODE_EXPIRY_MS;

  emailVerificationCodes.set(email, { code, email, expiresAt });

  const mailOptions = {
    from: '"modl" <noreply@cobl.gg>',
    to: email,
    subject: 'Your MODL Login Code',
    text: `Your login code is: ${code}`,
    html: `<p>Your login code is: <strong>${code}</strong></p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Error sending verification email via Postfix:', error);
    return res.status(500).json({ message: 'Failed to send verification code.' });
  }
});

// Route to verify email code
router.post('/verify-email-code', authRateLimit, async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and code are required.' });
  }

  const storedEntry = emailVerificationCodes.get(email);

  if (!storedEntry) {
    return res.status(400).json({ message: 'Invalid or expired verification code.' });
  }

  if (Date.now() > storedEntry.expiresAt) {
    emailVerificationCodes.delete(email);
    return res.status(400).json({ message: 'Verification code has expired.' });
  }

  if (storedEntry.code === code) {
    emailVerificationCodes.delete(email);

    // @ts-ignore
    const StaffModel = req.serverDbConnection!.model('Staff');
    const user = await StaffModel.findOne({ email });
    if (!user) {
      // @ts-ignore
      const serverConfigAdminEmail = req.modlServer?.adminEmail?.toLowerCase();
      if (email.toLowerCase() === serverConfigAdminEmail) {        // This is the server admin, create a session for them
        // @ts-ignore
        req.session.email = email;
        // @ts-ignore
        req.session.role = 'Super Admin';
        const username = email.split('@')[0] || 'admin';        // @ts-ignore
        req.session.username = username;
        // @ts-ignore
        req.session.userId = email;
        // @ts-ignore
        req.session.plan = 'premium';
        // @ts-ignore
        req.session.subscription_status = 'active';

        await req.session.save();
        return res.status(200).json({
          message: 'Admin email verified successfully. Logged in.',
          user: { id: email, email: email, username: username, role: 'Super Admin' }
        });
      } else {
        return res.status(404).json({ message: 'User not found after code verification.' });
      }
    } else {      // Store user information in session for regular staff member
      // @ts-ignore
      req.session.userId = user._id.toString();
      // @ts-ignore
      req.session.email = user.email;
      // @ts-ignore
      req.session.username = user.username;
      // @ts-ignore
      req.session.role = user.role;
      // @ts-ignore
      req.session.plan = user.plan || 'free';
      // @ts-ignore
      req.session.subscription_status = user.subscription_status || 'inactive';

      await req.session.save();

      return res.status(200).json({
        message: 'Email verified successfully. Logged in.',
        user: { id: user._id.toString(), email: user.email, username: user.username, role: user.role }
      });
    }
  } else {
    return res.status(400).json({ message: 'Invalid verification code.' });
  }
});

// Route to verify 2FA code
router.post('/verify-2fa-code', authRateLimit, async (req: Request, res: Response) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: 'Email and 2FA code are required.' });
  }

  try {
    // @ts-ignore
    const StaffModel = req.serverDbConnection!.model('Staff');
    const user = await StaffModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.isTwoFactorEnabled || !user.twoFaSecret) {
      return res.status(400).json({ message: '2FA is not enabled for this account.' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFaSecret });

    if (isValid) {      // Store user information in session
      // @ts-ignore
      req.session.userId = user._id.toString();
      // @ts-ignore
      req.session.email = user.email;
      // @ts-ignore
      req.session.username = user.username;
      // @ts-ignore
      req.session.role = user.role;
      // @ts-ignore
      req.session.plan = user.plan || 'free';
      // @ts-ignore
      req.session.subscription_status = user.subscription_status || 'inactive';

      await req.session.save();

      return res.status(200).json({
        message: '2FA code verified successfully. Logged in.',
        user: { id: user._id, email: user.email, username: user.username, role: user.role }
      });
    } else {
      return res.status(400).json({ message: 'Invalid 2FA code.' });
    }
  } catch (error) {
    console.error('Error verifying 2FA code:', error);
    return res.status(500).json({ message: 'Internal server error during 2FA verification.' });
  }
});

// Route to generate FIDO assertion options (challenge) for login
router.post('/fido-login-challenge', authRateLimit, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    // @ts-ignore
    const StaffModel = req.serverDbConnection!.model('Staff');
    const user = await StaffModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.passkeys || user.passkeys.length === 0) {
      return res.status(400).json({ message: 'No passkeys registered for this user.' });
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      allowCredentials: user.passkeys.map((pk: any) => ({
        id: pk.credentialID,
        type: 'public-key',
        transports: pk.transports as AuthenticatorTransport[] | undefined,
      })),
      userVerification: 'preferred',
      rpID,
    };

    const options = await generateAuthenticationOptions(opts);

    fidoChallenges.set(email, {
      challenge: options.challenge,
      email,
      expiresAt: Date.now() + CHALLENGE_EXPIRY_MS,
    });

    return res.status(200).json(options);
  } catch (error) {
    console.error('Error generating FIDO assertion options:', error);
    return res.status(500).json({ message: 'Failed to generate FIDO login challenge.' });
  }
});

// Route to verify FIDO assertion for login
router.post('/fido-login-verify', authRateLimit, async (req: Request, res: Response) => {
  const { email, assertionResponse } = req.body;

  if (!email || !assertionResponse) {
    return res.status(400).json({ message: 'Email and assertion response are required.' });
  }

  const storedChallengeEntry = fidoChallenges.get(email);

  if (!storedChallengeEntry) {
    return res.status(400).json({ message: 'Login challenge not found or expired. Please try again.' });
  }

  if (Date.now() > storedChallengeEntry.expiresAt) {
    fidoChallenges.delete(email);
    return res.status(400).json({ message: 'Login challenge expired. Please try again.' });
  }

  try {
    // @ts-ignore
    const StaffModel = req.serverDbConnection!.model('Staff');
    const user = await StaffModel.findOne({ email });
    if (!user || !user.passkeys || user.passkeys.length === 0) {
      return res.status(404).json({ message: 'User or passkeys not found.' });
    }

    // Find the authenticator that was used
    const authenticator = user.passkeys.find((pk: any) =>
      Buffer.from(assertionResponse.id, 'base64url').equals(pk.credentialID)
    );

    if (!authenticator) {
      return res.status(400).json({ message: 'Authenticator not recognized for this user.' });
    }    const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: storedChallengeEntry.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: authenticator,
      requireUserVerification: true,
    });

    if (verification.verified) {
      // Update the authenticator counter
      authenticator.counter = verification.authenticationInfo.newCounter;
      await user.save();

      fidoChallenges.delete(email);

      // @ts-ignore
      req.session.userId = user._id.toString();
      // @ts-ignore
      req.session.email = user.email;
      // @ts-ignore
      req.session.username = user.username;
      // @ts-ignore
      req.session.role = user.role;
      // @ts-ignore
      req.session.plan = user.plan || 'free';
      // @ts-ignore
      req.session.subscription_status = user.subscription_status || 'inactive';

      await req.session.save();

      return res.status(200).json({
        message: 'Passkey login successful. Logged in.',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
        },
      });
    } else {
      return res.status(400).json({ message: 'Passkey verification failed.' });
    }
  } catch (error: any) {
    console.error('Error verifying FIDO assertion:', error);
    fidoChallenges.delete(email);
    return res.status(500).json({ message: error.message || 'Failed to verify passkey.' });
  }
});

router.get('/session', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'development' && BYPASS_DEV_AUTH) {
    // Mock user for development mode
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        id: 'dev-user-id',
        email: 'dev@example.com',
        username: 'devuser',
        role: 'Super Admin', // Or any default role suitable for development
      },
      // @ts-ignore
      maintenanceMode: req.maintenanceConfig?.maintenanceMode || false,
      // @ts-ignore
      maintenanceMessage: req.maintenanceConfig?.maintenanceMessage || ''
    });
  }

  // @ts-ignore
  if (req.session && req.session.userId) {
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        // @ts-ignore
        id: req.session.userId,
        // @ts-ignore
        email: req.session.email,
        // @ts-ignore
        username: req.session.username,
        // @ts-ignore
        role: req.session.role,
      },
      // @ts-ignore
      maintenanceMode: req.maintenanceConfig?.maintenanceMode || false,
      // @ts-ignore
      maintenanceMessage: req.maintenanceConfig?.maintenanceMessage || ''
    });
  } else {
    return res.status(200).json({ 
      isAuthenticated: false,
      // @ts-ignore
      maintenanceMode: req.maintenanceConfig?.maintenanceMode || false,
      // @ts-ignore
      maintenanceMessage: req.maintenanceConfig?.maintenanceMessage || ''
    });
  }
});

// Route to logout and destroy session
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ message: 'Could not log out, please try again.' });
    }
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

// Profile update endpoint
router.patch('/profile', async (req: Request, res: Response) => {
  console.log('[PROFILE ENDPOINT] Profile update request received');
  console.log('[PROFILE ENDPOINT] Request method:', req.method);
  console.log('[PROFILE ENDPOINT] Request path:', req.path);
  console.log('[PROFILE ENDPOINT] Request body:', req.body);
  console.log('[PROFILE ENDPOINT] Session data:', req.session);
    try {
    const { username } = req.body;
    
    // Get user from session
    const userId = (req.session as any)?.userId;
    console.log('[PROFILE ENDPOINT] User ID from session:', userId);
    
    if (!userId) {
      console.log('[PROFILE ENDPOINT] No userId in session - returning 401');
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // Get the staff model from the server database connection
    // @ts-ignore
    const StaffModel = req.serverDbConnection!.model('Staff');
    
    // Prepare update data
    const updateData: any = {};
    if (username !== undefined) {
      updateData.username = username;
    }
      // Determine if userId is an email (for Super Admin) or an ObjectId (for regular staff)
    const isEmail = userId.includes('@');
    const userQuery = isEmail ? { email: userId } : { _id: userId };
    
    console.log('[PROFILE ENDPOINT] Is email:', isEmail);
    console.log('[PROFILE ENDPOINT] User query:', userQuery);
    console.log('[PROFILE ENDPOINT] Update data:', updateData);
    
    // Check if username is already taken (if updating username)
    if (username) {
      const existingUserQuery = isEmail 
        ? { username, email: { $ne: userId } }
        : { username, _id: { $ne: userId } };
      
      const existingUser = await StaffModel.findOne(existingUserQuery);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }
      // Update the user profile
    let updatedUser = await StaffModel.findOneAndUpdate(
      userQuery,
      updateData,
      { new: true, select: 'email username role' }
    );
    
    // If user not found and it's an email (Super Admin), handle session-only update
    if (!updatedUser && isEmail) {
      console.log('[PROFILE ENDPOINT] Super Admin not found in Staff collection - updating session only');
      // Super Admin should not be auto-created in Staff collection
      // Update session data directly for Super Admin
      if (username !== undefined) {
        (req.session as any).username = username;
      }
      
      await req.session.save();
      
      const sessionUser = {
        _id: userId,
        email: userId,
        username: username || userId.split('@')[0],
        role: 'Super Admin'
      };
      
      console.log('[PROFILE ENDPOINT] Super Admin session updated:', sessionUser);
      return res.json({ 
        message: 'Profile updated successfully',
        user: sessionUser
      });
    }
    
    if (!updatedUser) {
      console.log('[PROFILE ENDPOINT] User still not found after attempted creation');
      return res.status(404).json({ message: 'User not found' });
    }
      // Update session with new user data
    (req.session as any).username = updatedUser.username;
    
    res.json({ 
      message: 'Profile updated successfully',
      user: {
        _id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Profile update endpoint
router.patch('/profile', async (req: Request, res: Response) => {
  console.log('[PROFILE UPDATE] Profile update request received');
  
  try {
    const session = req.session as any;
    const userId = session?.userId;
    
    console.log('[PROFILE UPDATE] User ID from session:', userId);
    console.log('[PROFILE UPDATE] Request body:', req.body);
    
    if (!userId) {
      console.log('[PROFILE UPDATE] No userId in session - returning 401');
      return res.status(401).json({ message: 'Not authenticated' });
    }    const { username } = req.body;

    // If this is a Super Admin (identified by email as userId), update session only
    if (session.role === 'Super Admin') {
      if (username !== undefined) {
        session.username = username;
      }
      
      await req.session.save();
      
      const user = {
        _id: session.userId,
        email: session.email,
        username: session.username,
        role: session.role
      };
      
      console.log('[PROFILE UPDATE] Super Admin profile updated:', user);
      return res.json({ 
        message: 'Profile updated successfully',
        user 
      });
    }    // For regular staff, update database
    const User = req.serverDbConnection!.model('User');
    const updateData: any = {};
    
    if (username !== undefined) {
      updateData.username = username;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      console.log('[PROFILE UPDATE] User not found in database for ID:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Update session data
    if (username !== undefined) {
      session.username = updatedUser.username;
    }
    
    await req.session.save();

    const userData = {
      _id: updatedUser._id.toString(),
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role
    };

    console.log('[PROFILE UPDATE] Profile updated successfully:', userData);
    
    res.json({ 
      message: 'Profile updated successfully',
      user: userData 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Internal server error' });  }
});

// Session endpoint - get current user information
router.get('/session', async (req: Request, res: Response) => {
  console.log('[SESSION] Session check request received');
  
  try {    // Check for development bypass first
    if (BYPASS_DEV_AUTH && process.env.NODE_ENV === 'development') {
      console.log('[SESSION] Using development bypass');
      const user = {
        _id: 'dev-user-id',
        email: 'dev@example.com',
        username: 'devuser',
        role: 'Super Admin'
      };
      
      console.log('[SESSION] Returning dev bypass user:', user);
      return res.json({ 
        isAuthenticated: true, 
        user 
      });
    }

    const session = req.session as any;
    
    if (!session?.userId) {
      console.log('[SESSION] No userId in session');
      return res.json({ 
        isAuthenticated: false, 
        user: null 
      });
    }    console.log('[SESSION] Session found for user:', session.userId);
    console.log('[SESSION] Session data:', {
      userId: session.userId,
      email: session.email,
      username: session.username,
      role: session.role
    });    // If this is a Super Admin (identified by email as userId), return admin data
    if (session.role === 'Super Admin') {
      const user = {
        _id: session.userId,
        email: session.email,
        username: session.username,
        role: session.role
      };
      
      console.log('[SESSION] Returning Super Admin user:', user);
      return res.json({ 
        isAuthenticated: true, 
        user 
      });
    }

    // For regular staff, fetch from database to get latest profile data
    const User = req.serverDbConnection!.model('User');
    const user = await User.findById(session.userId);
    
    if (!user) {
      console.log('[SESSION] User not found in database for ID:', session.userId);
      return res.status(401).json({ 
        isAuthenticated: false, 
        user: null 
      });
    }    const userData = {
      _id: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role
    };

    console.log('[SESSION] Returning user data:', userData);
    
    res.json({ 
      isAuthenticated: true, 
      user: userData 
    });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ 
      isAuthenticated: false, 
      user: null 
    });
  }
});

export default router;