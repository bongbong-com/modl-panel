import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedAssertionResponse,
} from '@simplewebauthn/server';
import type { GenerateAssertionOptionsOpts } from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';


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

// Route to send email verification code
router.post('/send-email-code', async (req: Request, res: Response) => {
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
router.post('/verify-email-code', async (req: Request, res: Response) => {
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
      const serverConfigAdminEmail = req.serverConfig?.adminEmail?.toLowerCase();
      if (email.toLowerCase() === serverConfigAdminEmail) {
        // This is the server admin, create a session for them
        // @ts-ignore
        req.session.email = email;
        // @ts-ignore
        req.session.role = 'Super Admin';
        const username = email.split('@')[0] || 'admin';
        // @ts-ignore
        req.session.username = username;
        // @ts-ignore
        req.session.userId = email;

        await req.session.save();
        return res.status(200).json({
          message: 'Admin email verified successfully. Logged in.',
          user: { id: email, email: email, username: username, role: 'Super Admin' }
        });
      } else {
        return res.status(404).json({ message: 'User not found after code verification.' });
      }
    } else {
      // Store user information in session for regular staff member
      // @ts-ignore
      req.session.userId = user._id.toString();
      // @ts-ignore
      req.session.email = user.email;
      // @ts-ignore
      req.session.username = user.username;
      // @ts-ignore
      req.session.role = user.role;

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
      // @ts-ignore
      req.session.userId = user._id.toString();
      // @ts-ignore
      req.session.email = user.email;
      // @ts-ignore
      req.session.username = user.username;
      // @ts-ignore
      req.session.role = user.role;

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
        transports: pk.transports as AuthenticatorTransportFuture[] | undefined,
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
      requireUserVerification: true,
    });

    if (verification.verified) {
      // Update the authenticator counter
      authenticator.counter = verification.assertionInfo.newCounter;
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
    return res.status(200).json({ message: 'Logged out successfully.' });
  });
});

export default router;