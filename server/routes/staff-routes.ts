// filepath: d:\bongbong\modl-panel\server\routes\staff-routes.ts
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose, { Document as MongooseDocument, Connection, Model } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import { ModlServerSchema } from '../models/modl-global-schemas';

// Interfaces based on Mongoose schema and usage
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

// Interface for the ModlServer document from the global 'modl' database
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

// Middleware to check for serverDbConnection
router.use((req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  console.log(`[DEBUG] StaffRoutes: Router-level middleware ENTER. Path: ${req.path}. ServerName: ${req.serverName}. DB Connection valid: ${!!req.serverDbConnection}`);
  if (!req.serverDbConnection) {
    // @ts-ignore
    console.error(`[DEBUG] StaffRoutes: Router-level middleware - NO DB CONNECTION. Path: ${req.path}. ServerName: ${req.serverName}. Responding 503.`);
    return res.status(503).json({ error: 'Service unavailable. Database connection not established for this server.' });
  }
  if (!req.serverName) {
    // @ts-ignore
    console.error(`[DEBUG] StaffRoutes: Router-level middleware - NO SERVER NAME. Path: ${req.path}. Responding 500.`);
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  // @ts-ignore
  console.log(`[DEBUG] StaffRoutes: Router-level middleware - ALL CHECKS PASSED, calling next(). Path: ${req.path}. ServerName: ${req.serverName}`);
  next();
});

// Public routes - should be defined before authentication middleware

router.get('/check-email/:email', async (req: Request<{ email: string }>, res: Response) => {
  // @ts-ignore
  console.log(`[DEBUG] StaffRoutes: /check-email/:email handler. ServerName: ${req.serverName}. DB Connection valid: ${!!req.serverDbConnection}. Path: ${req.path}. Params: ${JSON.stringify(req.params)}`);
  try {
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      console.log(`[DEBUG] StaffRoutes: /api/staff/check-email/:email - DEV MODE. Email: ${req.params.email}. ServerName: ${req.serverName}. DB Connection valid: ${!!req.serverDbConnection}`);
      // In development mode, accept any email and assume no 2FA/FIDO for simplicity
      return res.json({
        exists: true,
        isTwoFactorEnabled: false, // Default to false for any dev email
        hasFidoPasskeys: false    // Default to false for any dev email
      });
    }

    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const requestedEmail = req.params.email.toLowerCase(); // Normalize requested email

    // Try to find the user in the tenant's Staff collection
    const staffMember = await Staff.findOne({ email: requestedEmail });

    if (staffMember) {
      const hasFidoPasskeys = !!(staffMember.passkeys && staffMember.passkeys.length > 0);
      return res.json({
        exists: true,
        isTwoFactorEnabled: !!staffMember.isTwoFactorEnabled,
        hasFidoPasskeys: hasFidoPasskeys
      });
    }

    // If not found in Staff, check if it's the main admin email for this server
    // This requires accessing the 'modl' database's 'servers' collection
    try {
      const ModlServer = mongoose.model<IModlServer>('Server', ModlServerSchema);
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

    // If not a staff member and not the dynamic admin email
    return res.json({ exists: false, isTwoFactorEnabled: false, hasFidoPasskeys: false });

  } catch (error) {
    // console.error(`[Server: ${req.serverName}] Error checking email:`, error); // Hidden
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/staff/check-username/:username', async (req: Request<{ username: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ username: req.params.username });
    res.json({ exists: !!staffMember });
  } catch (error) {
    // console.error(`[Server: ${req.serverName}] Error checking username:`, error); // Hidden
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply isAuthenticated middleware to all routes in this router AFTER public routes
router.use(isAuthenticated);

// Get all staff
router.get('/api/staff', async (req: Request, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staff = await Staff.find({}).select('-twoFaSecret -passkeys'); // Updated to hide passkeys array
    res.json(staff);
  } catch (error) {
    // console.error(`[Server: ${req.serverName}] Error fetching staff:`, error); // Hidden
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff by username
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
    // console.error(`[Server: ${req.serverName}] Error fetching staff member:`, error); // Hidden
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
    // console.error(`[Server: ${req.serverName}] Error creating staff member:`, error); // Hidden
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

    // Authorization for email change
    if (email !== undefined && email !== staffMember.email) {
      if (req.currentUser!.username !== staffMember.username) {
        return res.status(403).json({ error: 'Forbidden: You can only change your own email address.' });
      }
      // Check if new email is already in use by another user
      const existingStaffWithNewEmail = await Staff.findOne({ email: email, _id: { $ne: staffMember._id } });
      if (existingStaffWithNewEmail) {
        return res.status(409).json({ error: 'Email address already in use by another account.' });
      }
      staffMember.email = email;
      changesMade = true;
    }

    // Authorization for profile picture change
    if (profilePicture !== undefined && profilePicture !== staffMember.profilePicture) {
      if (req.currentUser!.username !== staffMember.username && !req.currentUser!.admin) {
        return res.status(403).json({ error: 'Forbidden: You can only change your own profile picture, or an admin must perform this action.' });
      }
      staffMember.profilePicture = profilePicture;
      changesMade = true;
    }

    // Authorization for admin status change
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
    // console.error(`[Server: ${req.serverName}] Error updating staff member:`, error); // Hidden
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddPasskeyBody {
  credentialId: string;
  publicKey: string;
  aaguid: string;
}

// This route /api/staff/:username/passkey is for adding a single passkey.
// With the schema change to support multiple passkeys, this route's logic would need
// to be updated to push to the `passkeys` array.
// For the current task (FIDO login), we are not implementing registration,
// so this route is not directly modified but noted for future refactoring.
// If it were to be updated:
// router.post('/api/staff/:username/passkeys', async (req: Request<{ username: string }, {}, AddPasskeyBody>, res: Response) => {
//   try {
//     const Staff = req.serverDbConnection!.model<IStaff>('Staff');
//     // Assuming AddPasskeyBody is updated for Buffer types and new fields
//     const { credentialID, credentialPublicKey, counter, transports, aaguid } = req.body;
//
//     const staffMember = await Staff.findOne({ username: req.params.username });
//     if (!staffMember) {
//       return res.status(404).json({ error: 'Staff member not found' });
//     }
//
//     if (!staffMember.passkeys) {
//       staffMember.passkeys = [];
//     }
//     staffMember.passkeys.push({
//       credentialID: Buffer.from(credentialID, 'base64url'), // Example conversion
//       credentialPublicKey: Buffer.from(credentialPublicKey, 'base64url'), // Example conversion
//       counter,
//       transports,
//       aaguid,
//       createdAt: new Date()
//     });
//
//     await staffMember.save();
//     res.status(200).json({ message: 'Passkey added successfully' });
//   } catch (error) {
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });


// These routes have been moved to before the isAuthenticated middleware

export default router;
