import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose, { Document as MongooseDocument, Connection, Model } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkRole } from '../middleware/role-middleware';
import { Invitation } from '../models/invitation-schema';
import nodemailer from 'nodemailer';
import { getModlServersModel } from '../db/connectionManager';
import { strictRateLimit, authRateLimit } from '../middleware/rate-limiter';

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
  role: 'Super Admin' | 'Admin' | 'Moderator' | 'Helper';
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

router.get('/check-username/:username', async (req: Request<{ username: string }>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffMember = await Staff.findOne({ username: req.params.username });
    res.json({ exists: !!staffMember });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/invitations/accept', strictRateLimit, async (req: Request, res: Response) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: 'Invalid invitation link.' });
  }

  try {
    const InvitationModel = req.serverDbConnection!.model('Invitation', Invitation.schema);
    const invitation = await InvitationModel.findOne({ token: token as string });

    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invitation is invalid, expired, or has already been used.' });
    }

    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const { email, role } = invitation;
    const username = email.split('@')[0]; // Or generate a unique username

    const newUser = new Staff({
      email,
      username,
      role,
    });

    await newUser.save();

    invitation.status = 'accepted';
    await invitation.save();

    // Log the new user in
    req.session.userId = newUser._id.toString();
    req.session.email = newUser.email;
    req.session.username = newUser.username;
    req.session.role = newUser.role;

    await req.session.save();

    res.status(200).json({ message: 'Invitation accepted successfully.' });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// Apply isAuthenticated middleware to all routes in this router AFTER public routes
router.use(isAuthenticated);

router.get('/', checkRole(['Super Admin', 'Admin']), async (req: Request, res: Response) => {
  try {
    const db = req.serverDbConnection!;
    const UserModel = db.model('Staff');
    const InvitationModel = db.model('Invitation');

    const users = await UserModel.find({});
    const invitations = await InvitationModel.find({ status: 'pending' });

    const staff = users.map(user => ({
      ...user.toObject(),
      status: 'Active'
    }));

    const pendingInvitations = invitations.map(invitation => ({
      _id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt,
      status: 'Pending Invitation'
    }));

    const allStaff = [...staff, ...pendingInvitations];

    res.json(allStaff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

router.post('/invite', authRateLimit, checkRole(['Super Admin', 'Admin']), async (req: Request, res: Response) => {
  const { email, role } = req.body;
  const invitingUser = req.currentUser!;

  if (invitingUser.role === 'Admin' && role === 'Admin') {
    return res.status(403).json({ message: 'Admins cannot invite other Admins.' });
  }

  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const existingUser = await Staff.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email is already associated with an existing user.' });
    }

    const InvitationModel = req.serverDbConnection!.model('Invitation', Invitation.schema);
    const existingInvitation = await InvitationModel.findOne({ email, status: 'pending' });
    if (existingInvitation) {
      return res.status(409).json({ message: 'An invitation for this email is already pending.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const newInvitation = new InvitationModel({
      email,
      role,
      token,
      expiresAt,
    });

    await newInvitation.save();

    const appDomain = process.env.DOMAIN || "modl.gg";
    const invitationLink = `https://${req.modlServer?.customDomain}.${appDomain}/accept-invitation?token=${token}`;
    
    const mailOptions = {
      from: '"modl" <noreply@cobl.gg>',
      to: email,
      subject: 'You have been invited to join the team!',
      text: `Please accept your invitation by clicking the following link: ${invitationLink}`,
      html: `<p>Please accept your invitation by clicking the following link: <a href="${invitationLink}">${invitationLink}</a></p>`,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: 'Invitation sent successfully.' });
  } catch (error) {
    console.error('Error inviting staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/invitations/:id/resend', authRateLimit, checkRole(['Super Admin', 'Admin']), async (req: Request, res: Response) => {
      try {
        const db = req.serverDbConnection!;
        const InvitationModel = db.model('Invitation');
        const invitation = await InvitationModel.findById(req.params.id);

        if (!invitation) {
          return res.status(404).send('Invitation not found');
        }

        // Generate new token and expiry
        invitation.token = crypto.randomBytes(32).toString('hex');
        invitation.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await invitation.save();

        // Resend email logic (copy from the invite route)
        const appDomain = process.env.DOMAIN || 'modl.gg';
        const invitationLink = `https://${req.modlServer?.customDomain}.${appDomain}/accept-invitation?token=${invitation.token}`;
        
        const mailOptions = {
          from: '"modl" <noreply@cobl.gg>',
          to: invitation.email,
          subject: 'You have been invited to join the team!',
          text: `Please accept your invitation by clicking the following link: ${invitationLink}`,
          html: `<p>Please accept your invitation by clicking the following link: <a href="${invitationLink}">${invitationLink}</a></p>`,
        };
    
        await transporter.sendMail(mailOptions);

        res.status(200).send('Invitation resent successfully');
      } catch (error) {
        console.error('Error resending invitation:', error);
        res.status(500).send('Failed to resend invitation');
      }
    });

router.delete('/:id', checkRole(['Super Admin', 'Admin']), async (req: Request, res: Response) => {
    const { id } = req.params;
    const removerUser = req.currentUser!;

    try {
        const InvitationModel = req.serverDbConnection!.model('Invitation');
        const invitationResult = await InvitationModel.deleteOne({ _id: id });

        if (invitationResult.deletedCount > 0) {
            return res.status(200).json({ message: 'Invitation cancelled successfully.' });
        }

        const Staff = req.serverDbConnection!.model<IStaff>('Staff');
        const userToRemove = await Staff.findById(id);

        if (!userToRemove) {
            return res.status(404).json({ message: 'User or invitation not found.' });
        }

        if (removerUser.role === 'Admin' && (userToRemove.role === 'Admin' || userToRemove.role === 'Super Admin')) {
            return res.status(403).json({ message: 'Admins can only remove Moderators and Helpers.' });
        }

        if (removerUser.userId === id) {
            return res.status(400).json({ message: 'You cannot remove yourself.' });
        }

        await Staff.findByIdAndDelete(id);

        // Invalidate sessions for the removed user
        const sessionStore = req.sessionStore;
        sessionStore.all((err: any, sessions: { [x: string]: any; }) => {
            if (err) {
                console.error('Error fetching sessions:', err);
                return;
            }
            Object.keys(sessions).forEach(sid => {
                if (sessions[sid].userId === id) {
                    sessionStore.destroy(sid, (err: any) => {
                        if (err) {
                            console.error(`Error destroying session ${sid}:`, err);
                        }
                    });
                }
            });
        });

        res.status(200).json({ message: 'User removed successfully.' });
    } catch (error) {
        console.error('Error removing staff:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/:username', async (req: Request<{ username: string }>, res: Response) => {
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
  role?: 'Super Admin' | 'Admin' | 'Moderator' | 'Helper';
}

router.post('/', async (req: Request<{}, {}, CreateStaffBody>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const { email, username, profilePicture, role } = req.body;
    
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
      role: role || 'Helper',
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
  role?: 'Super Admin' | 'Admin' | 'Moderator' | 'Helper';
}

// Route to update general staff information
router.patch('/:username', async (req: Request<{ username: string }, {}, UpdateStaffBody>, res: Response) => {
  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const { email, profilePicture, role } = req.body;
    
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
      if (req.currentUser!.username !== staffMember.username && !['Super Admin', 'Admin'].includes(req.currentUser!.role)) {
        return res.status(403).json({ error: 'Forbidden: You can only change your own profile picture, or an admin must perform this action.' });
      }
      staffMember.profilePicture = profilePicture;
      changesMade = true;
    }

    if (role !== undefined && role !== staffMember.role) {
      if (req.currentUser!.role !== 'Super Admin') {
        return res.status(403).json({ error: 'Forbidden: Only a Super Admin can change roles.' });
      }
      staffMember.role = role;
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

// Route to change a staff member's role
router.patch('/:id/role', checkRole(['Super Admin', 'Admin']), async (req: Request<{ id: string }, {}, { role: IStaff['role'] }>, res: Response) => {
  const { id } = req.params;
  const { role: newRole } = req.body;
  const performingUser = req.currentUser!;

  if (!newRole || !['Super Admin', 'Admin', 'Moderator', 'Helper'].includes(newRole)) {
    return res.status(400).json({ message: 'Invalid role specified.' });
  }

  try {
    const Staff = req.serverDbConnection!.model<IStaff>('Staff');
    const staffToUpdate = await Staff.findById(id);

    if (!staffToUpdate) {
      return res.status(404).json({ message: 'Staff member not found.' });
    }

    // Super Admin can change any role to any other role.
    if (performingUser.role === 'Super Admin') {
      // No restrictions for Super Admin
    } else if (performingUser.role === 'Admin') {
      // Admins cannot change their own role.
      if (staffToUpdate._id.toString() === performingUser.userId) {
        return res.status(403).json({ message: 'Admins cannot change their own role.' });
      }
      // Admins cannot change anyone to Admin or Super Admin.
      if (newRole === 'Admin' || newRole === 'Super Admin') {
        return res.status(403).json({ message: 'Admins cannot assign Admin or Super Admin roles.' });
      }
      // Admins cannot change an existing Admin or Super Admin's role.
      if (staffToUpdate.role === 'Admin' || staffToUpdate.role === 'Super Admin') {
        return res.status(403).json({ message: 'Admins cannot change the role of other Admins or Super Admins.' });
      }
    } else {
      // Other roles (Moderator, Helper) cannot change roles. This should be caught by checkRole, but as a safeguard:
      return res.status(403).json({ message: 'Forbidden: You do not have permission to change roles.' });
    }

    if (staffToUpdate.role === newRole) {
      return res.status(200).json({ message: 'Role is already set to the specified value.', staffMember: staffToUpdate });
    }

    staffToUpdate.role = newRole;
    await staffToUpdate.save();

    // Invalidate sessions for the user if their role changed, forcing re-login for new permissions
    // This is important if session-based permissions are granular.
    // For simplicity, we might skip direct session invalidation here if role changes are infrequent
    // or if a brief period of old permissions is acceptable until next login.
    // However, for security critical role changes, session invalidation is recommended.
    // Example:
    // const sessionStore = req.sessionStore;
    // sessionStore.all((err: any, sessions: { [x: string]: any; }) => {
    //   if (err) { console.error('Error fetching sessions for role change:', err); return; }
    //   Object.keys(sessions).forEach(sid => {
    //     if (sessions[sid].userId === id) {
    //       sessionStore.destroy(sid, (destroyErr: any) => {
    //         if (destroyErr) { console.error(`Error destroying session ${sid} for role change:`, destroyErr); }
    //       });
    //     }
    //   });
    // });


    res.status(200).json({ message: 'Role updated successfully.', staffMember: staffToUpdate });

  } catch (error) {
    console.error('Error changing staff role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
 
// These routes have been moved to before the isAuthenticated middleware
 
export default router;
