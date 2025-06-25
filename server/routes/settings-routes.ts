import express, { Request, Response, NextFunction } from 'express';
import { Connection, Document as MongooseDocument, HydratedDocument } from 'mongoose'; // Renamed Document to MongooseDocument, Added HydratedDocument
import { isAuthenticated } from '../middleware/auth-middleware';
import domainRoutes from './domain-routes';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { generateTicketApiKey } from '../middleware/ticket-api-auth';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface IDurationDetail {
  value: number;
  unit: string;
}

interface IPunishmentDurations {
  low: { first: IDurationDetail; medium: IDurationDetail; habitual: IDurationDetail };
  regular: { first: IDurationDetail; medium: IDurationDetail; habitual: IDurationDetail };
  severe: { first: IDurationDetail; medium: IDurationDetail; habitual: IDurationDetail };
}

interface IPunishmentPoints {
  low: number;
  regular: number;
  severe: number;
}

interface IPunishmentType {
  id: number;
  name: string;
  category: string;
  isCustomizable: boolean;
  ordinal: number;
  durations?: IPunishmentDurations;
  points?: IPunishmentPoints;
  permanentUntilUsernameChange?: boolean;
  permanentUntilSkinChange?: boolean;
  customPoints?: number; // For permanent punishments that don't use severity-based points
}

interface IAppealFormField {
  id: string;
  type: 'checkbox' | 'text' | 'textarea' | 'dropdown';
  label: string;
  description?: string;
  required: boolean;
  options?: string[]; // For dropdown fields
  order: number;
}

interface IAppealFormSettings {
  fields: IAppealFormField[];
}

interface IStatusThresholds {
  gameplay: { medium: number; habitual: number };
  social: { medium: number; habitual: number };
}

interface ISystemSettings {
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  requireAdminApproval: boolean;
  requireTwoFactor: boolean;
}

interface ITicketFormField {
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  required: boolean;
  options?: string[];
}

interface ITicketForms {
  [key: string]: ITicketFormField[];
}

interface ISettingsDocument extends MongooseDocument {
  settings: Map<string, any>;
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

router.use(isAuthenticated);

// Mount domain routes
router.use('/domain', domainRoutes);

export async function createDefaultSettings(dbConnection: Connection, serverName?: string): Promise<HydratedDocument<ISettingsDocument>> {
  try {
    const SettingsModel = dbConnection.model<ISettingsDocument>('Settings');
    const defaultSettingsMap = new Map<string, any>();

    // Only include core Administrative punishment types (ordinals 0-5, not customizable)
    const corePunishmentTypes: IPunishmentType[] = [
      { id: 0, name: 'Kick', category: 'Administrative', isCustomizable: false, ordinal: 0 },
      { id: 1, name: 'Manual Mute', category: 'Administrative', isCustomizable: false, ordinal: 1 },
      { id: 2, name: 'Manual Ban', category: 'Administrative', isCustomizable: false, ordinal: 2 },
      { id: 3, name: 'Security Ban', category: 'Administrative', isCustomizable: false, ordinal: 3 },
      { id: 4, name: 'Linked Ban', category: 'Administrative', isCustomizable: false, ordinal: 4 },
      { id: 5, name: 'Blacklist', category: 'Administrative', isCustomizable: false, ordinal: 5 }
    ];
    
    const statusThresholds: IStatusThresholds = {
      gameplay: { medium: 5, habitual: 10 },
      social: { medium: 4, habitual: 8 }
    };
    
    defaultSettingsMap.set('punishmentTypes', corePunishmentTypes);
    defaultSettingsMap.set('statusThresholds', statusThresholds);
    
    defaultSettingsMap.set('ticketTags', [
      'bug', 'player', 'chat', 'appeal', 'high-priority', 'needs-review',
      'in-progress', 'resolved', 'won\'t-fix', 'duplicate'
    ]);
    
    const systemSettings: ISystemSettings = {
      maxLoginAttempts: 5,
      lockoutDuration: 30 * 60 * 1000, // 30 minutes
      sessionTimeout: 2 * 60 * 60 * 1000, // 2 hours
      requireAdminApproval: true,
      requireTwoFactor: true
    };
    defaultSettingsMap.set('system', systemSettings);
    
    const ticketForms: ITicketForms = {
      'bug': [
        { fieldName: 'description', fieldLabel: 'Bug Description', fieldType: 'textarea', required: true },
        { fieldName: 'steps', fieldLabel: 'Steps to Reproduce', fieldType: 'textarea', required: true },
        { fieldName: 'expected', fieldLabel: 'Expected Behavior', fieldType: 'textarea', required: true },
        { fieldName: 'actual', fieldLabel: 'Actual Behavior', fieldType: 'textarea', required: true },
        { fieldName: 'server', fieldLabel: 'Server', fieldType: 'text', required: true },
        { fieldName: 'version', fieldLabel: 'Game Version', fieldType: 'text', required: false }
      ],
      'player': [
        { fieldName: 'description', fieldLabel: 'Describe the Incident', fieldType: 'textarea', required: true },
        { fieldName: 'serverName', fieldLabel: 'Server Name', fieldType: 'text', required: true },
        { fieldName: 'when', fieldLabel: 'When did this happen?', fieldType: 'text', required: true },
        { fieldName: 'evidence', fieldLabel: 'Evidence (screenshots, videos, etc.)', fieldType: 'textarea', required: false }
      ],
      'chat': [
        { fieldName: 'description', fieldLabel: 'Describe the Issue', fieldType: 'textarea', required: true },
        { fieldName: 'serverName', fieldLabel: 'Server Name', fieldType: 'text', required: true },
        { fieldName: 'when', fieldLabel: 'When did this happen?', fieldType: 'text', required: true },
        { fieldName: 'chatlog', fieldLabel: 'Copy & Paste Chat Log', fieldType: 'textarea', required: true }
      ],
      'staff': [
        { fieldName: 'experience', fieldLabel: 'Previous Experience', fieldType: 'textarea', required: true },
        { fieldName: 'age', fieldLabel: 'Age', fieldType: 'text', required: true },
        { fieldName: 'timezone', fieldLabel: 'Timezone', fieldType: 'text', required: true },
        { fieldName: 'availability', fieldLabel: 'Weekly Availability (hours)', fieldType: 'text', required: true },
        { fieldName: 'why', fieldLabel: 'Why do you want to join our staff team?', fieldType: 'textarea', required: true },
        { fieldName: 'skills', fieldLabel: 'Special Skills', fieldType: 'textarea', required: false }
      ],
      'support': [
        { fieldName: 'description', fieldLabel: 'How can we help you?', fieldType: 'textarea', required: true },
        { fieldName: 'category', fieldLabel: 'Support Category', fieldType: 'select', 
          options: ['Account Issues', 'Technical Help', 'Purchases', 'Other'],
          required: true 
        },
        { fieldName: 'priority', fieldLabel: 'Priority', fieldType: 'select', 
          options: ['Low', 'Medium', 'High'],
          required: true 
        }
      ]
    };
    defaultSettingsMap.set('ticketForms', ticketForms);
    
    // Add default appeal form settings
    const defaultAppealForm: IAppealFormSettings = {
      fields: [
        {
          id: 'reason',
          type: 'textarea',
          label: 'Appeal Reason',
          description: 'Please explain why you believe this punishment should be reviewed',
          required: true,
          order: 1
        },
        {
          id: 'evidence',
          type: 'text',
          label: 'Evidence Links (Optional)',
          description: 'Provide links to any screenshots, videos, or other evidence',
          required: false,
          order: 2
        },
        {
          id: 'acknowledge_error',
          type: 'checkbox',
          label: 'I believe this punishment was issued in error',
          description: 'Check this box if you believe you were wrongfully punished',
          required: false,
          order: 3
        }
      ]
    };
    defaultSettingsMap.set('appealForm', defaultAppealForm);
    
    // Add general settings defaults
    const generalSettings = {
      serverDisplayName: serverName || '',
      homepageIconUrl: '',
      panelIconUrl: ''
    };
    defaultSettingsMap.set('general', generalSettings);
    
    const newSettingsDoc = new SettingsModel({ settings: defaultSettingsMap });
    await newSettingsDoc.save();
    return newSettingsDoc;
  } catch (error) {
    throw error;
  }
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.modlServer?.serverName);
    }
    if (!settingsDoc) { // Should not happen if createDefaultSettings is successful
        return res.status(500).json({ error: 'Failed to retrieve or create settings document' });
    }
    // Convert Map to object and wrap in a 'settings' key
    res.json({ settings: Object.fromEntries(settingsDoc.settings) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.modlServer?.serverName);
    }

    if (!settingsDoc) { // Should not happen
        return res.status(500).json({ error: 'Failed to retrieve or create settings document for update' });
    }
    
    for (const key in req.body) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        settingsDoc.settings.set(key, req.body[key]);
      }
    }
    await settingsDoc.save();
    // Convert Map to object and wrap in a 'settings' key
    res.json({ settings: Object.fromEntries(settingsDoc.settings) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset', async (req: Request, res: Response) => {
  try {
    const SettingsModel = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    await SettingsModel.deleteOne({});
    const defaultSettings = await createDefaultSettings(req.serverDbConnection!, req.modlServer?.serverName);
    // Convert Map to object and wrap in a 'settings' key
    res.json({ settings: Object.fromEntries(defaultSettings.settings) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API Key Management Routes - Moved before generic /:key route to prevent interception

// Get current ticket API key (masked for security)
router.get('/ticket-api-key', async (req: Request, res: Response) => {
  try {
    console.log('[Ticket API Key GET] Request received');
    console.log('[Ticket API Key GET] Server name:', req.serverName);
    console.log('[Ticket API Key GET] DB connection exists:', !!req.serverDbConnection);
    
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    console.log('[Ticket API Key GET] Settings doc found:', !!settingsDoc);
    console.log('[Ticket API Key GET] Settings map exists:', !!settingsDoc?.settings);
    
    if (!settingsDoc || !settingsDoc.settings) {
      console.log('[Ticket API Key GET] No settings found, returning 404');
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    const apiKey = settingsDoc.settings.get('ticket_api_key');
    console.log('[Ticket API Key GET] API key exists:', !!apiKey);
    console.log('[Ticket API Key GET] API key length:', apiKey ? apiKey.length : 0);
    
    if (!apiKey) {
      console.log('[Ticket API Key GET] No API key found, returning hasApiKey: false');
      return res.json({ 
        hasApiKey: false,
        maskedKey: null
      });
    }
    
    // Return masked key for security (show only first 8 and last 4 characters)
    const maskedKey = apiKey.length > 12 
      ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
      : `${apiKey.substring(0, 4)}...`;
    
    console.log('[Ticket API Key GET] Returning masked key:', maskedKey);
    res.json({ 
      hasApiKey: true,
      maskedKey 
    });
  } catch (error) {
    console.error('Error fetching ticket API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate new ticket API key
router.post('/ticket-api-key/generate', async (req: Request, res: Response) => {
  try {
    console.log('[Ticket API Key GENERATE] Request received');
    console.log('[Ticket API Key GENERATE] Server name:', req.serverName);
    console.log('[Ticket API Key GENERATE] DB connection exists:', !!req.serverDbConnection);
    
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    
    console.log('[Ticket API Key GENERATE] Settings doc found:', !!settingsDoc);
    
    // Create settings document if it doesn't exist
    if (!settingsDoc) {
      console.log('[Ticket API Key GENERATE] Creating default settings document');
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.serverName);
    }
    
    // Generate new API key
    const newApiKey = generateTicketApiKey();
    console.log('[Ticket API Key GENERATE] Generated new API key with length:', newApiKey.length);
    
    // Save to settings
    settingsDoc.settings.set('ticket_api_key', newApiKey);
    await settingsDoc.save();
    console.log('[Ticket API Key GENERATE] Saved API key to database');
    
    // Verify it was saved
    const verifyDoc = await Settings.findOne({});
    const savedKey = verifyDoc?.settings.get('ticket_api_key');
    console.log('[Ticket API Key GENERATE] Verification - API key saved correctly:', !!savedKey);
    console.log('[Ticket API Key GENERATE] Verification - API key matches:', savedKey === newApiKey);
    
    // Return the full key only once (for copying)
    res.json({ 
      apiKey: newApiKey,
      message: 'New ticket API key generated successfully. Please save this key as it will not be shown again.' 
    });
  } catch (error) {
    console.error('Error generating ticket API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke ticket API key
router.delete('/ticket-api-key', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc || !settingsDoc.settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    // Remove the API key
    settingsDoc.settings.delete('ticket_api_key');
    await settingsDoc.save();
    
    res.json({ 
      message: 'Ticket API key revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking ticket API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Minecraft API Key Management Routes

// Get current minecraft API key (masked for security)
router.get('/minecraft-api-key', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc || !settingsDoc.settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    const apiKey = settingsDoc.settings.get('minecraft_api_key');
    
    if (!apiKey) {
      return res.json({ 
        hasApiKey: false,
        maskedKey: null
      });
    }
    
    // Return masked key for security (show only first 8 and last 4 characters)
    const maskedKey = apiKey.length > 12 
      ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
      : `${apiKey.substring(0, 4)}...`;
    
    res.json({ 
      hasApiKey: true,
      maskedKey 
    });
  } catch (error) {
    console.error('Error fetching minecraft API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate new minecraft API key
router.post('/minecraft-api-key/generate', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    
    // Create settings document if it doesn't exist
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.serverName);
    }
    
    // Generate new API key (using same function as ticket API key)
    const newApiKey = generateTicketApiKey();
    
    // Save to settings
    settingsDoc.settings.set('minecraft_api_key', newApiKey);
    await settingsDoc.save();
    
    // Return the full key only once (for copying)
    res.json({ 
      apiKey: newApiKey,
      message: 'New minecraft API key generated successfully. Please save this key as it will not be shown again.' 
    });
  } catch (error) {
    console.error('Error generating minecraft API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke minecraft API key
router.delete('/minecraft-api-key', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc || !settingsDoc.settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    // Remove the API key
    settingsDoc.settings.delete('minecraft_api_key');
    await settingsDoc.save();
    
    res.json({ 
      message: 'Minecraft API key revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking minecraft API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:key', async (req: Request<{ key: string }>, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    if (!settingsDoc || !settingsDoc.settings.has(req.params.key)) {
      return res.status(404).json({ error: `Setting key '${req.params.key}' not found` });
    }
    res.json({ key: req.params.key, value: settingsDoc.settings.get(req.params.key) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:key', async (req: Request<{ key: string }, {}, { value: any }>, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.modlServer?.serverName);
    }
    if (!settingsDoc) { // Should not happen
        return res.status(500).json({ error: 'Failed to retrieve or create settings document for update' });
    }
    settingsDoc.settings.set(req.params.key, req.body.value);
    await settingsDoc.save();
    res.json({ key: req.params.key, value: settingsDoc.settings.get(req.params.key) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// File upload endpoint for server icons
router.post('/upload-icon', upload.single('icon'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { iconType } = req.query;
    if (!iconType || (iconType !== 'homepage' && iconType !== 'panel')) {
      return res.status(400).json({ error: 'Invalid or missing iconType parameter. Must be "homepage" or "panel"' });
    }

    const serverName = req.serverName;
    if (!serverName) {
      return res.status(500).json({ error: 'Server name not found' });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', serverName);
    try {
      await mkdir(uploadsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Generate filename with timestamp to avoid caching issues
    const fileExtension = path.extname(req.file.originalname) || '.png';
    const fileName = `${iconType}-icon-${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file to disk
    await writeFile(filePath, req.file.buffer);

    // Generate URL for the uploaded file
    const fileUrl = `/uploads/${serverName}/${fileName}`;

    res.json({ 
      success: true, 
      url: fileUrl,
      iconType: iconType
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Function to add default Social and Gameplay punishment types during provisioning
export async function addDefaultPunishmentTypes(dbConnection: Connection): Promise<void> {
  try {
    const SettingsModel = dbConnection.model<ISettingsDocument>('Settings');
    let settingsDoc = await SettingsModel.findOne({});
    
    if (!settingsDoc) {
      throw new Error('Settings document not found. createDefaultSettings should be called first.');
    }

    // Get existing punishment types
    const existingTypes = settingsDoc.settings.get('punishmentTypes') || [];
    
    // Check if we already have Social and Gameplay types (ordinals 6+)
    const hasCustomTypes = existingTypes.some((type: IPunishmentType) => type.ordinal > 5);
    if (hasCustomTypes) {
      console.log('Custom punishment types already exist, skipping default creation');
      return;
    }

    // Default Social punishment types (customizable, ordered as requested)
    const defaultSocialTypes: IPunishmentType[] = [
      { 
        id: 8, 
        name: 'Chat Abuse', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 6,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 2, unit: 'days' }, habitual: { value: 4, unit: 'days' } },
          regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
        },
        points: { low: 1, regular: 2, severe: 4 }
      },
      { 
        id: 9, 
        name: 'Anti Social', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 7,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 2, unit: 'days' }, habitual: { value: 4, unit: 'days' } },
          regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
        },
        points: { low: 2, regular: 3, severe: 4 }
      },
      { 
        id: 10, 
        name: 'Targeting', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 8,
        durations: {
          low: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          regular: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          severe: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } }
        },
        points: { low: 2, regular: 4, severe: 6 }
      },
      { 
        id: 11, 
        name: 'Bad Content', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 9,
        durations: {
          low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
        },
        points: { low: 3, regular: 5, severe: 7 }
      },
      { 
        id: 6, 
        name: 'Bad Skin', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 10,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
          severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
        },
        points: { low: 1, regular: 2, severe: 3 }
      },
      { 
        id: 7, 
        name: 'Bad Name', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 11,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
          severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
        },
        points: { low: 1, regular: 2, severe: 3 }
      }
    ];

    // Default Gameplay punishment types (customizable, ordered as requested)
    const defaultGameplayTypes: IPunishmentType[] = [
      { 
        id: 12, 
        name: 'Team Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 12,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
          severe: { first: { value: 4, unit: 'days' }, medium: { value: 10, unit: 'days' }, habitual: { value: 30, unit: 'days' } }
        },
        points: { low: 1, regular: 2, severe: 3 }
      },
      { 
        id: 13, 
        name: 'Game Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 13,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          regular: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          severe: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } }
        },
        points: { low: 2, regular: 4, severe: 6 }
      },
      { 
        id: 17, 
        name: 'Systems Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 14,
        durations: {
          low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
        },
        points: { low: 3, regular: 5, severe: 7 }
      },
      { 
        id: 16, 
        name: 'Account Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 15,
        durations: {
          low: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          regular: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } },
          severe: { first: { value: 30, unit: 'days' }, medium: { value: 60, unit: 'days' }, habitual: { value: 120, unit: 'days' } }
        },
        points: { low: 4, regular: 6, severe: 8 }
      },
      { 
        id: 15, 
        name: 'Game Trading', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 16,
        durations: {
          low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
        },
        points: { low: 3, regular: 5, severe: 7 }
      },
      { 
        id: 14, 
        name: 'Cheating', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 17,
        durations: {
          low: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          regular: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } },
          severe: { first: { value: 30, unit: 'days' }, medium: { value: 60, unit: 'days' }, habitual: { value: 180, unit: 'days' } }
        },
        points: { low: 4, regular: 7, severe: 10 }
      }
    ];

    // Combine existing core types with new default types
    const allPunishmentTypes = [...existingTypes, ...defaultSocialTypes, ...defaultGameplayTypes];
    
    // Update the settings document
    settingsDoc.settings.set('punishmentTypes', allPunishmentTypes);
    await settingsDoc.save();
    
    console.log('Added default Social and Gameplay punishment types to database');
  } catch (error) {
    console.error('Error adding default punishment types:', error);
    throw error;
  }
}

export default router;
