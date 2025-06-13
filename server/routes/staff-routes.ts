import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose, { Document as MongooseDocument, Connection, Model } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import { getModlServersModel } from '../db/connectionManager';

interface IPasskey {
  credentialID: Buffer; // Changed from string, made required
  credentialPublicKey: Buffer; // Changed from string, made required
  counter: number; // Renamed from signCount, made required
  transports?: string[]; // Added transports array
  aaguid?: string; // Made optional as per schema
  createdAt: Date;
}

interface IStaff extends MongooseDocument {
  email: string;
  username: string;
  profilePicture?: string;
  admin: boolean;
  twoFaSecret?: string;
  isTwoFactorEnabled?: boolean;
  passkeys?: IPasskey[]; // Changed to an array of IPasskey
}

interface IModlServer extends MongooseDocument {
  adminEmail: string;
  serverName: string;
  customDomain: string;
  plan: 'free' | 'paid';
  emailVerified?: boolean;
  provisioningStatus?: 'pending' | 'in-progress' | 'completed' | 'failed';
  databaseName?: string;
  createdAt: Date;
  updatedAt: Date;
}


const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ error: 'Service unavailable. Database connection not established for this server.' });
  }
  if (!req.serverName) {
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  next();
});

// Public routes - should be defined before authentication middleware

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

    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
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

router.get('/api/staff/check-username/:username', async (req: Request<{ username: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ username: req.params.username });
    res.json({ exists: !!staffMember });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply isAuthenticated middleware to all routes in this router AFTER public routes
router.use(isAuthenticated);

router.get('/api/staff', async (req: Request, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staff = await Staff.find({}).select('-twoFaSecret -passkeys'); // Updated to hide passkeys array
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/staff/:username', async (req: Request<{ username: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ username: req.params.username })
      .select('-twoFaSecret -passkeys'); // Updated to hide passkeys array
    
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    res.json(staffMember);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface CreateStaffBody {
  email: string;
  username: string;
  profilePicture?: string;
  admin?: boolean;
}

router.post('/api/staff', async (req: Request<{}, {}, CreateStaffBody>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const { email, username, profilePicture, admin } = req.body;
    
    const existingStaff = await Staff.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingStaff) {
      return res.status(409).json({ error: 'Staff member with this email or username already exists' });
    }
    
    const twoFaSecret = crypto.randomBytes(10).toString('hex');    
    const newStaff = new Staff({
      email,
      username,
      profilePicture,
      admin: admin || false,
      twoFaSecret
    });
    
    await newStaff.save();
    
    const safeStaff = newStaff.toObject() as Partial<IStaff>;    delete safeStaff.twoFaSecret;
    
    res.status(201).json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface UpdateStaffBody {
  email?: string;
  profilePicture?: string;
  admin?: boolean;
}

router.patch('/api/staff/:username', async (req: Request<{ username: string }, {}, UpdateStaffBody>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const { email, profilePicture, admin } = req.body;
    
    const staffMember = await Staff.findOne({ username: req.params.username });
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    // The isAuthenticated middleware now handles the primary authentication check.
    // Authorization logic below will use req.session data.
    // Ensure req.session.username and req.session.admin are available from the session.

    let changesMade = false;

    if (email !== undefined && email !== staffMember.email) {
      if (req.currentUser!.username !== staffMember.username) {
        return res.status(403).json({ error: 'Forbidden: You can only change your own email address.' });
      }
      const existingStaffWithNewEmail = await Staff.findOne({ email: email, _id: { $ne: staffMember._id } });
      if (existingStaffWithNewEmail) {
        return res.status(409).json({ error: 'Email address already in use by another account.' });
      }
      staffMember.email = email;
      changesMade = true;
    }

    if (profilePicture !== undefined && profilePicture !== staffMember.profilePicture) {
      if (req.currentUser!.username !== staffMember.username && !req.currentUser!.admin) {
        return res.status(403).json({ error: 'Forbidden: You can only change your own profile picture, or an admin must perform this action.' });
      }
      staffMember.profilePicture = profilePicture;
      changesMade = true;
    }

    if (admin !== undefined && admin !== staffMember.admin) {
      if (!req.currentUser!.admin) {
        return res.status(403).json({ error: 'Forbidden: Only administrators can change admin status.' });
      }
      staffMember.admin = admin;
      changesMade = true;
    }

    if (changesMade) {
      await staffMember.save();
    }
    
    const safeStaff = staffMember.toObject() as Partial<IStaff>;    delete safeStaff.twoFaSecret;
    // passkeys array is already excluded by the select statement or not typically returned in this context
    // If it were, individual fields would be: delete safeStaff.passkeys;
    
    res.json(safeStaff);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddPasskeyBody {
  credentialId: string;
  publicKey: string;
  aaguid: string;
}

// These routes have been moved to before the isAuthenticated middleware

export default router;
