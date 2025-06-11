// filepath: d:\bongbong\modl-panel\server\routes\settings-routes.ts
import express, { Request, Response, NextFunction } from 'express';
import { Connection, Document as MongooseDocument } from 'mongoose'; // Renamed Document to MongooseDocument

// Define interfaces for settings structures
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

// Interface for the Settings document
interface ISettingsDocument extends MongooseDocument {
  settings: Map<string, any>;
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

// Helper function to create default settings
async function createDefaultSettings(dbConnection: Connection): Promise<ISettingsDocument> {
  try {
    const SettingsModel = dbConnection.model<ISettingsDocument>('Settings');
    const defaultSettingsMap = new Map<string, any>();

    const punishmentTypes: IPunishmentType[] = [
      { id: 0, name: 'Kick', category: 'Gameplay', isCustomizable: false, ordinal: 0 },
      { id: 1, name: 'Manual Mute', category: 'Social', isCustomizable: false, ordinal: 1 },
      { id: 2, name: 'Manual Ban', category: 'Gameplay', isCustomizable: false, ordinal: 2 },
      { id: 3, name: 'Security Ban', category: 'Gameplay', isCustomizable: false, ordinal: 3 },
      { id: 4, name: 'Linked Ban', category: 'Gameplay', isCustomizable: false, ordinal: 4 },
      { id: 5, name: 'Blacklist', category: 'Gameplay', isCustomizable: false, ordinal: 5 },
      { 
        id: 6, 
        name: 'Bad Skin', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 6,
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
        ordinal: 7,
        durations: {
          low: { first: { value: 24, unit: 'hours' }, medium: { value: 3, unit: 'days' }, habitual: { value: 7, unit: 'days' } },
          regular: { first: { value: 2, unit: 'days' }, medium: { value: 4, unit: 'days' }, habitual: { value: 10, unit: 'days' } },
          severe: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } }
        },
        points: { low: 1, regular: 2, severe: 3 }
      },
      { 
        id: 8, 
        name: 'Chat Abuse', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 8,
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
        ordinal: 9,
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
        ordinal: 10,
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
        ordinal: 11,
        durations: {
          low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
        },
        points: { low: 3, regular: 5, severe: 7 }
      },
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
        id: 14, 
        name: 'Cheating', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 14,
        durations: {
          low: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          regular: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } },
          severe: { first: { value: 30, unit: 'days' }, medium: { value: 60, unit: 'days' }, habitual: { value: 180, unit: 'days' } }
        },
        points: { low: 4, regular: 7, severe: 10 }
      },
      { 
        id: 15, 
        name: 'Game Trading', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 15,
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
        ordinal: 16,
        durations: {
          low: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          regular: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } },
          severe: { first: { value: 30, unit: 'days' }, medium: { value: 60, unit: 'days' }, habitual: { value: 120, unit: 'days' } }
        },
        points: { low: 4, regular: 6, severe: 8 }
      },
      { 
        id: 17, 
        name: 'Scamming', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 17,
        durations: {
          low: { first: { value: 3, unit: 'days' }, medium: { value: 7, unit: 'days' }, habitual: { value: 14, unit: 'days' } },
          regular: { first: { value: 7, unit: 'days' }, medium: { value: 14, unit: 'days' }, habitual: { value: 30, unit: 'days' } },
          severe: { first: { value: 14, unit: 'days' }, medium: { value: 30, unit: 'days' }, habitual: { value: 60, unit: 'days' } }
        },
        points: { low: 3, regular: 5, severe: 7 }
      }
    ];
    
    const statusThresholds: IStatusThresholds = {
      gameplay: { medium: 5, habitual: 10 },
      social: { medium: 4, habitual: 8 }
    };
    
    defaultSettingsMap.set('punishmentTypes', punishmentTypes);
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
    
    const newSettingsDoc = new SettingsModel({ settings: defaultSettingsMap });
    await newSettingsDoc.save();
    console.log('Default settings created successfully.');
    return newSettingsDoc;
  } catch (error) {
    console.error('Error creating default settings:', error);
    throw error;
  }
}

// Get all settings
router.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings(req.serverDbConnection!);
    }
    
    const plainSettings = settingsDoc.toObject();
    res.json(plainSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.patch('/api/settings', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const updatedSettingsPayload: Record<string, any> = req.body;
    console.log(`[Server: ${req.serverName}] Received updatedSettingsPayload:`, JSON.stringify(updatedSettingsPayload, null, 2));
    
    let settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc) {
      console.log(`[Server: ${req.serverName}] No settings document found, creating default.`);
      settingsDoc = await createDefaultSettings(req.serverDbConnection!);
    } else {
      console.log(`[Server: ${req.serverName}] Found existing settings document.`);
    }
    
    if (!(settingsDoc.settings instanceof Map)) {
      console.warn(`[Server: ${req.serverName}] settingsDoc.settings was not a Map, initializing.`);
      settingsDoc.settings = new Map<string, any>();
    }

    console.log(`[Server: ${req.serverName}] settingsDoc.settings BEFORE update loop:`, JSON.stringify(Object.fromEntries(settingsDoc.settings), null, 2));

    for (const key in updatedSettingsPayload) {
      if (Object.prototype.hasOwnProperty.call(updatedSettingsPayload, key)) {
        const value = updatedSettingsPayload[key];
        console.log(`[Server: ${req.serverName}] Setting in settingsDoc.settings: key='${key}', value='${JSON.stringify(value, null, 2).substring(0, 100)}...'`);
        settingsDoc.settings.set(key, value);
      }
    }
    
    console.log(`[Server: ${req.serverName}] settingsDoc.settings AFTER update loop:`, JSON.stringify(Object.fromEntries(settingsDoc.settings), null, 2));

    try {
      await settingsDoc.save();
      console.log(`[Server: ${req.serverName}] settingsDoc.save() successful.`);
      const plainSavedSettings = settingsDoc.toObject();
      res.json(plainSavedSettings);
    } catch (saveError: any) {
      console.error(`[Server: ${req.serverName}] Error during settingsDoc.save():`, saveError);
      res.status(500).json({ error: 'Internal server error during save', details: saveError.message });
    }

  } catch (error) {
    console.error(`[Server: ${req.serverName}] General error in PATCH /api/settings:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset settings to default
router.post('/api/settings/reset', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    await Settings.deleteMany({});
    const settings = await createDefaultSettings(req.serverDbConnection!);
    res.json(settings.toObject());
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific setting
router.get('/api/settings/:key', async (req: Request<{ key: string }>, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const { key } = req.params;
    let settings = await Settings.findOne({});
    
    if (!settings) {
      settings = await createDefaultSettings(req.serverDbConnection!);
    }
    
    const value = settings.settings.get(key);
    
    if (value === undefined) {
      return res.status(404).json({ error: `Setting '${key}' not found` });
    }
    
    res.json({ key, value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update specific setting
router.put('/api/settings/:key', async (req: Request<{ key: string }, {}, { value: any }>, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'No value provided' });
    }
    
    let settings = await Settings.findOne({});
    
    if (!settings) {
      settings = await createDefaultSettings(req.serverDbConnection!);
    }
    
    settings.settings.set(key, value);
    await settings.save();
    
    res.json({ key, value });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
