// filepath: d:\bongbong\modl-panel\server\routes\staff-routes.ts
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Document as MongooseDocument, Connection } from 'mongoose';

// Interfaces based on Mongoose schema and usage
interface IPasskey {
  credentialId?: string; // Made optional
  publicKey?: string; // Made optional
  signCount: number;
  aaguid: string;
  createdAt: Date;
}

interface IStaff extends MongooseDocument {
  email: string;
  username: string;
  profilePicture?: string;
  admin: boolean;
  twoFaSecret?: string; // Made optional
  passkey?: IPasskey;
}

const router = express.Router();

// Middleware to check for serverDbConnection
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    console.error('Database connection not found for this server.');
    return res.status(503).json({ error: 'Service unavailable. Database connection not established for this server.' });
  }
  if (!req.serverName) {
    console.error('Server name not found in request.');
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  next();
});

// Get all staff
router.get('/api/staff', async (req: Request, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staff = await Staff.find({}).select('-twoFaSecret -passkey.publicKey -passkey.credentialId -passkey.signCount');
    res.json(staff);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error fetching staff:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff by username
router.get('/api/staff/:username', async (req: Request<{ username: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ username: req.params.username })
      .select('-twoFaSecret -passkey.publicKey -passkey.credentialId -passkey.signCount');
    
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    res.json(staffMember);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error fetching staff member:`, error);
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
      return res.status(400).json({ error: 'Staff member with this email or username already exists' });
    }
    
    const twoFaSecret = crypto.randomBytes(10).toString('hex'); // Changed to hex as base32 is not standard for Buffer.toString()
    
    const newStaff = new Staff({
      email,
      username,
      profilePicture,
      admin: admin || false,
      twoFaSecret
    });
    
    await newStaff.save();
    
    const safeStaff = newStaff.toObject() as Partial<IStaff>; // Cast to allow delete
    delete safeStaff.twoFaSecret;
    
    res.status(201).json(safeStaff);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error creating staff member:`, error);
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
    
    if (email) staffMember.email = email;
    if (profilePicture) staffMember.profilePicture = profilePicture;
    if (admin !== undefined) staffMember.admin = admin;
    
    await staffMember.save();
    
    const safeStaff = staffMember.toObject() as Partial<IStaff>; // Cast to allow delete
    delete safeStaff.twoFaSecret;
    if (safeStaff.passkey) {
        delete safeStaff.passkey.publicKey;
        delete safeStaff.passkey.credentialId;
    }
    
    res.json(safeStaff);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error updating staff member:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface AddPasskeyBody {
  credentialId: string;
  publicKey: string;
  aaguid: string;
}

router.post('/api/staff/:username/passkey', async (req: Request<{ username: string }, {}, AddPasskeyBody>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const { credentialId, publicKey, aaguid } = req.body;
    
    const staffMember = await Staff.findOne({ username: req.params.username });
    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    staffMember.passkey = {
      credentialId,
      publicKey,
      signCount: 0,
      aaguid,
      createdAt: new Date()
    };
    
    await staffMember.save();
    
    const safeStaff = staffMember.toObject() as Partial<IStaff>; // Cast to allow delete
    delete safeStaff.twoFaSecret;
    if (safeStaff.passkey) {
        delete safeStaff.passkey.publicKey;
        delete safeStaff.passkey.credentialId;
    }
    
    res.json(safeStaff);
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error adding passkey:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/staff/check-email/:email', async (req: Request<{ email: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ email: req.params.email });
    res.json({ exists: !!staffMember });
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error checking email:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/staff/check-username/:username', async (req: Request<{ username: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ username: req.params.username });
    res.json({ exists: !!staffMember });
  } catch (error) {
    console.error(`[Server: ${req.serverName}] Error checking username:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
