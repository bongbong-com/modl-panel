import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
// Staff model will be obtained from req.serverDbConnection
// import { Staff } from '../models/mongodb-schemas';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedAssertionResponse,
} from '@simplewebauthn/server';
import type { GenerateAssertionOptionsOpts } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';


// Relying Party ID and expected origin - replace with your actual domain in production
const rpID = 'localhost'; // This should match your domain
const expectedOrigin = process.env.NODE_ENV === 'production'
  ? `https://${process.env.APP_DOMAIN}` // Assuming you have APP_DOMAIN in .env
  : 'http://localhost:5173'; // Common Vite dev server port

const router = Router();

// Configure nodemailer for local Postfix
const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false, // true for 465, false for other ports
  tls: {
    rejectUnauthorized: false // Necessary for self-signed certs or no TLS
  }
});

interface EmailCodeEntry {
  code: string;
  email: string;
  expiresAt: number;
}

// In-memory store for email verification codes (replace with a persistent store in production)
const emailVerificationCodes = new Map<string, EmailCodeEntry>();
const fidoChallenges = new Map<string, { challenge: string, email: string, expiresAt: number }>();
const CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for FIDO challenges

function generateNumericCode(length: number = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

// Route to send email verification code
router.post('/send-email-code', async (req: Request, res: Response) => {
  console.log(`[AUTH_DEBUG] Received request for /api/auth/send-email-code with body:`, req.body);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  // Optional: Validate if email exists in your system (e.g., Staff collection)
  // const user = await Staff.findOne({ email });
  // if (!user) {
  //   return res.status(404).json({ message: 'Email not found.' });
  // }

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
    console.log(`Verification code ${code} sent to ${email} via Postfix.`);
    console.log(`[AUTH_DEBUG] Sending 200 response for /api/auth/send-email-code`);
    return res.status(200).json({ message: 'Verification code sent to your email.' });
  } catch (error) {
    console.error('Error sending verification email via Postfix:', error);
    console.log(`[AUTH_DEBUG] Sending 500 response for /api/auth/send-email-code due to error`);
    return res.status(500).json({ message: 'Failed to send verification code.' });
  }
});

// Route to verify email code
router.post('/verify-email-code', async (req: Request, res: Response) => {
  console.log(`[AUTH_DEBUG] Received request for /api/auth/verify-email-code with body:`, req.body);
  const { email, code } = req.body;

  if (!email || !code) {
    console.log(`[AUTH_DEBUG] Sending 400 response for /api/auth/verify-email-code (missing email or code)`);
    return res.status(400).json({ message: 'Email and code are required.' });
  }

  const storedEntry = emailVerificationCodes.get(email);

  if (!storedEntry) {
    console.log(`[AUTH_DEBUG] Sending 400 response for /api/auth/verify-email-code (no stored entry)`);
    return res.status(400).json({ message: 'Invalid or expired verification code.' });
  }

  if (Date.now() > storedEntry.expiresAt) {
    emailVerificationCodes.delete(email); // Clean up expired code
    console.log(`[AUTH_DEBUG] Sending 400 response for /api/auth/verify-email-code (code expired)`);
    return res.status(400).json({ message: 'Verification code has expired.' });
  }

  if (storedEntry.code === code) {
    emailVerificationCodes.delete(email); // Code verified, remove it

    // @ts-ignore
    const StaffModel = req.serverDbConnection!.model('Staff');
    const user = await StaffModel.findOne({ email });
    if (!user) {
      // @ts-ignore
      const serverConfigAdminEmail = req.serverConfig?.adminEmail?.toLowerCase();
      if (email.toLowerCase() === serverConfigAdminEmail) {
        // This is the server admin, create a session for them
        console.log(`[AUTH_DEBUG] Verified server admin email ${email}. Creating admin session.`);
        req.session.email = email;
        req.session.admin = true;
        // Derive username and userId for admin session
        const username = email.split('@')[0] || 'admin';
        req.session.username = username;
        req.session.userId = email; // Using email as userId for global admin

        await req.session.save();
        return res.status(200).json({
          message: 'Admin email verified successfully. Logged in.',
          user: { id: email, email: email, username: username, admin: true }
        });
      } else {
        console.log(`[AUTH_DEBUG] User not found for email ${email} in Staff collection and does not match server admin email.`);
        return res.status(404).json({ message: 'User not found after code verification.' });
      }
    } else {
      // Store user information in session for regular staff member
      req.session.userId = user._id.toString();
      req.session.email = user.email;
      req.session.username = user.username;
      req.session.admin = user.admin;

      await req.session.save(); // Ensure session is saved before responding

      console.log(`[AUTH_DEBUG] Session created for user ${user.username}. Sending 200 response for /api/auth/verify-email-code (success)`);
      return res.status(200).json({
        message: 'Email verified successfully. Logged in.',
        user: { id: user._id.toString(), email: user.email, username: user.username, admin: user.admin }
      });
    }
  } else {
    console.log(`[AUTH_DEBUG] Sending 400 response for /api/auth/verify-email-code (invalid code)`);
    return res.status(400).json({ message: 'Invalid verification code.' });
  }
});

// Route to verify 2FA code
router.post('/verify-2fa-code', async (req: Request, res: Response) => {
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

    if (isValid) {
      // Store user information in session
      req.session.userId = user._id.toString();
      req.session.email = user.email;
      req.session.username = user.username;
      req.session.admin = user.admin;

      await req.session.save(); // Ensure session is saved before responding

      console.log(`[AUTH_DEBUG] Session created for user ${user.username} after 2FA.`);
      return res.status(200).json({
        message: '2FA code verified successfully. Logged in.',
        user: { id: user._id, email: user.email, username: user.username, admin: user.admin }
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
router.post('/fido-login-challenge', async (req: Request, res: Response) => {
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

    const opts: GenerateAssertionOptionsOpts = {
      allowCredentials: user.passkeys.map(pk => ({
        id: pk.credentialID,
        type: 'public-key',
        transports: pk.transports as AuthenticatorTransportFuture[] | undefined, // Cast if necessary
      })),
      userVerification: 'preferred',
      rpID,
    };

    const options = await generateAuthenticationOptions(opts);

    // Store the challenge for verification
    fidoChallenges.set(email, { // Using email as key for simplicity, consider user ID if available
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
router.post('/fido-login-verify', async (req: Request, res: Response) => {
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
    const authenticator = user.passkeys.find(pk =>
      Buffer.from(assertionResponse.id, 'base64url').equals(pk.credentialID)
    );

    if (!authenticator) {
      return res.status(400).json({ message: 'Authenticator not recognized for this user.' });
    }

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge: storedChallengeEntry.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: authenticator.credentialID,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: authenticator.counter,
        transports: authenticator.transports as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true, // Or 'preferred' or 'discouraged' based on your policy
    });

    if (verification.verified) {
      // Update the authenticator counter
      authenticator.counter = verification.assertionInfo.newCounter;
      await user.save();

      fidoChallenges.delete(email); // Clean up challenge

      // Store user information in session
      req.session.userId = user._id.toString();
      req.session.email = user.email;
      req.session.username = user.username;
      req.session.admin = user.admin;

      await req.session.save(); // Ensure session is saved before responding

      console.log(`[AUTH_DEBUG] Session created for user ${user.username} after FIDO login.`);
      return res.status(200).json({
        message: 'Passkey login successful. Logged in.',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          admin: user.admin,
        },
      });
    } else {
      return res.status(400).json({ message: 'Passkey verification failed.' });
    }
  } catch (error: any) {
    console.error('Error verifying FIDO assertion:', error);
    fidoChallenges.delete(email); // Clean up challenge on error
    return res.status(500).json({ message: error.message || 'Failed to verify passkey.' });
  }
});

// Route to check session status
router.get('/session', (req: Request, res: Response) => {
  // @ts-ignore
  console.log(`[AUTH_DEBUG] /api/auth/session called. Cookies: ${JSON.stringify(req.headers.cookie)}, Session ID: ${req.sessionID}, Session UserID: ${req.session?.userId}, Full session: ${JSON.stringify(req.session)}`);
  if (req.session && req.session.userId) {
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.email,
        username: req.session.username,
        admin: req.session.admin,
      },
    });
  } else {
    return res.status(200).json({ isAuthenticated: false });
  }
});

// Route to logout and destroy session
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ message: 'Could not log out, please try again.' });
    }
    // Session cookie is typically cleared by session middleware on destroy
    // If specific cookie clearing is needed: res.clearCookie('connect.sid'); // Replace 'connect.sid' if using a different session cookie name
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

export default router;