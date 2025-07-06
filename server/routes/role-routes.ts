import express, { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkRole } from '../middleware/role-middleware';
import { strictRateLimit } from '../middleware/rate-limiter';

const router = express.Router();

// Permission definitions
interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'punishment' | 'ticket' | 'admin';
}

interface StaffRole {
  _id?: string;
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Middleware to ensure database connection
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.serverDbConnection) {
    return res.status(503).json({ error: 'Service unavailable. Database connection not established for this server.' });
  }
  if (!req.serverName) {
    return res.status(500).json({ error: 'Internal server error. Server name missing.' });
  }
  next();
});

// Apply authentication middleware
router.use(isAuthenticated);

// Define base permissions that are always available
const getBasePermissions = (): Permission[] => [
  // Admin permissions
  { id: 'admin.settings.view', name: 'View Settings', description: 'View all system settings', category: 'admin' },
  { id: 'admin.settings.modify', name: 'Modify Settings', description: 'Modify system settings (excluding account settings)', category: 'admin' },
  { id: 'admin.staff.manage', name: 'Manage Staff', description: 'Invite, remove, and modify staff members', category: 'admin' },
  { id: 'admin.analytics.view', name: 'View Analytics', description: 'Access system analytics and reports', category: 'admin' },
  
  // Ticket permissions
  { id: 'ticket.view.all', name: 'View All Tickets', description: 'View all tickets regardless of type', category: 'ticket' },
  { id: 'ticket.reply.all', name: 'Reply to All Tickets', description: 'Reply to all ticket types', category: 'ticket' },
  { id: 'ticket.close.all', name: 'Close/Reopen All Tickets', description: 'Close and reopen all ticket types', category: 'ticket' },
  { id: 'ticket.delete.all', name: 'Delete Tickets', description: 'Delete tickets from the system', category: 'ticket' },
];

// Get punishment permissions based on current punishment types
const getPunishmentPermissions = async (dbConnection: Connection): Promise<Permission[]> => {
  try {
    const Settings = dbConnection.model('Settings');
    const settingsDoc = await Settings.findOne({});
    const punishmentTypes = settingsDoc?.settings?.get('punishmentTypes') || [];
    
    return punishmentTypes.map((type: any) => ({
      id: `punishment.apply.${type.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: `Apply ${type.name}`,
      description: `Permission to apply ${type.name} punishments`,
      category: 'punishment' as const
    }));
  } catch (error) {
    console.error('Error fetching punishment permissions:', error);
    return [];
  }
};

// GET /api/panel/roles/permissions - Get all available permissions
router.get('/permissions', checkRole(['Super Admin', 'Admin']), async (req: Request, res: Response) => {
  try {
    const basePermissions = getBasePermissions();
    const punishmentPermissions = await getPunishmentPermissions(req.serverDbConnection!);
    
    const allPermissions = [...basePermissions, ...punishmentPermissions];
    
    res.json({
      permissions: allPermissions,
      categories: {
        punishment: 'Punishment Permissions',
        ticket: 'Ticket Permissions',
        admin: 'Administrative Permissions'
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/panel/roles - Get all roles
router.get('/', checkRole(['Super Admin', 'Admin']), async (req: Request, res: Response) => {
  try {
    const db = req.serverDbConnection!;
    
    // Try to get custom roles from the database
    let StaffRoles;
    try {
      StaffRoles = db.model('StaffRole');
    } catch {
      // If model doesn't exist, create it
      const StaffRoleSchema = new db.base.Schema({
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        permissions: [{ type: String }],
        isDefault: { type: Boolean, default: false }
      }, { timestamps: true });
      
      StaffRoles = db.model('StaffRole', StaffRoleSchema);
    }
    
    const customRoles = await StaffRoles.find({});
    
    // Default system roles
    const defaultRoles: StaffRole[] = [
      {
        id: 'super-admin',
        name: 'Super Admin',
        description: 'Full access to all features and settings',
        permissions: [
          'admin.settings.view', 'admin.settings.modify', 'admin.staff.manage', 'admin.analytics.view',
          'ticket.view.all', 'ticket.reply.all', 'ticket.close.all', 'ticket.delete.all'
        ],
        isDefault: true,
      },
      {
        id: 'admin',
        name: 'Admin',
        description: 'Administrative access with some restrictions',
        permissions: [
          'admin.settings.view', 'admin.staff.manage', 'admin.analytics.view',
          'ticket.view.all', 'ticket.reply.all', 'ticket.close.all'
        ],
        isDefault: true,
      },
      {
        id: 'moderator',
        name: 'Moderator',
        description: 'Moderation permissions for punishments and tickets',
        permissions: ['ticket.view.all', 'ticket.reply.all', 'ticket.close.all'],
        isDefault: true,
      },
      {
        id: 'helper',
        name: 'Helper',
        description: 'Basic support permissions',
        permissions: ['ticket.view.all', 'ticket.reply.all'],
        isDefault: true,
      },
    ];

    // Add punishment permissions to default roles
    const punishmentPermissions = await getPunishmentPermissions(db);
    const allPunishmentPerms = punishmentPermissions.map(p => p.id);
    
    // Super Admin and Admin get all punishment permissions
    defaultRoles[0].permissions.push(...allPunishmentPerms);
    defaultRoles[1].permissions.push(...allPunishmentPerms);
    
    // Moderator gets all punishment permissions except the most severe ones
    const moderatorPunishmentPerms = allPunishmentPerms.filter(p => 
      !p.includes('blacklist') && !p.includes('security-ban')
    );
    defaultRoles[2].permissions.push(...moderatorPunishmentPerms);

    // Get staff counts for each role
    const Staff = db.model('Staff');
    const roleCounts = await Staff.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    const roleCountMap = roleCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // Add user counts to roles
    const rolesWithCounts = [
      ...defaultRoles.map(role => ({
        ...role,
        userCount: roleCountMap[role.name] || 0
      })),
      ...customRoles.map((role: any) => ({
        ...role.toObject(),
        userCount: roleCountMap[role.name] || 0
      }))
    ];
    
    res.json({ roles: rolesWithCounts });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/panel/roles - Create a new custom role
router.post('/', checkRole(['Super Admin']), strictRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body;
    
    if (!name || !description || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Invalid role data' });
    }
    
    const db = req.serverDbConnection!;
    
    // Create/get the StaffRole model
    let StaffRoles;
    try {
      StaffRoles = db.model('StaffRole');
    } catch {
      const StaffRoleSchema = new db.base.Schema({
        id: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        permissions: [{ type: String }],
        isDefault: { type: Boolean, default: false }
      }, { timestamps: true });
      
      StaffRoles = db.model('StaffRole', StaffRoleSchema);
    }
    
    // Generate unique ID
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate permissions against available permissions
    const basePermissions = getBasePermissions();
    const punishmentPermissions = await getPunishmentPermissions(db);
    const allValidPermissions = [...basePermissions, ...punishmentPermissions].map(p => p.id);
    
    const invalidPermissions = permissions.filter((p: string) => !allValidPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid permissions', 
        invalidPermissions 
      });
    }
    
    const newRole = new StaffRoles({
      id,
      name,
      description,
      permissions,
      isDefault: false
    });
    
    await newRole.save();
    
    res.status(201).json({ 
      message: 'Role created successfully',
      role: newRole.toObject()
    });
  } catch (error) {
    console.error('Error creating role:', error);
    if ((error as any).code === 11000) {
      return res.status(409).json({ error: 'Role name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/panel/roles/:id - Update a custom role
router.put('/:id', checkRole(['Super Admin']), strictRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    
    if (!name || !description || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Invalid role data' });
    }
    
    const db = req.serverDbConnection!;
    
    // Cannot update default roles
    if (id.includes('super-admin') || id.includes('admin') || id.includes('moderator') || id.includes('helper')) {
      return res.status(403).json({ error: 'Cannot modify default system roles' });
    }
    
    const StaffRoles = db.model('StaffRole');
    
    // Validate permissions
    const basePermissions = getBasePermissions();
    const punishmentPermissions = await getPunishmentPermissions(db);
    const allValidPermissions = [...basePermissions, ...punishmentPermissions].map(p => p.id);
    
    const invalidPermissions = permissions.filter((p: string) => !allValidPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid permissions', 
        invalidPermissions 
      });
    }
    
    const updatedRole = await StaffRoles.findOneAndUpdate(
      { id },
      { name, description, permissions },
      { new: true }
    );
    
    if (!updatedRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json({ 
      message: 'Role updated successfully',
      role: updatedRole.toObject()
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/panel/roles/:id - Delete a custom role
router.delete('/:id', checkRole(['Super Admin']), strictRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = req.serverDbConnection!;
    
    // Cannot delete default roles
    if (id.includes('super-admin') || id.includes('admin') || id.includes('moderator') || id.includes('helper')) {
      return res.status(403).json({ error: 'Cannot delete default system roles' });
    }
    
    const StaffRoles = db.model('StaffRole');
    const Staff = db.model('Staff');
    
    // Check if any staff members are using this role
    const roleInUse = await Staff.findOne({ role: id });
    if (roleInUse) {
      return res.status(409).json({ 
        error: 'Cannot delete role that is currently assigned to staff members',
        message: 'Please reassign all staff members to a different role before deleting this role.'
      });
    }
    
    const deletedRole = await StaffRoles.findOneAndDelete({ id });
    
    if (!deletedRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;