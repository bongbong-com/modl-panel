import express, { Request, Response, NextFunction } from 'express';
import { Connection, Document as MongooseDocument, HydratedDocument } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import domainRoutes from './domain-routes';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { generateTicketApiKey } from '../middleware/ticket-api-auth';
// Removed unused imports - interfaces are defined locally below

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface IDurationDetail {
  value: number;
  unit: string;
  type: string;
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
  customPoints?: number; // For permanent punishments that don't use severity-based points
  appealForm?: IAppealFormSettings; // Punishment-specific appeal form configuration
  staffDescription?: string; // Description shown to staff when applying this punishment
  playerDescription?: string; // Description shown to players (in appeals, notifications, etc.)
  canBeAltBlocking?: boolean; // Whether this punishment can block alternative accounts
  canBeStatWiping?: boolean; // Whether this punishment can wipe player statistics
  singleSeverityPunishment?: boolean; // Whether this punishment uses single severity instead of three levels
  singleSeverityDurations?: {
    first: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
    medium: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
    habitual: { value: number; unit: 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban'; };
  };
  singleSeverityPoints?: number; // Points for single severity punishments
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

interface IAIModerationSettings {
  enableAutomatedActions: boolean;
  strictnessLevel: 'lenient' | 'standard' | 'strict';
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
      { 
        id: 0, 
        name: 'Kick', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 0,
        staffDescription: 'Immediately remove the player from the server. Use for minor infractions or when a player needs to be removed quickly.',
        playerDescription: 'You have been kicked from the server.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'reason',
              type: 'textarea',
              label: 'Why do you believe you were wrongfully kicked?',
              description: 'Explain the circumstances around your kick',
              required: true,
              order: 1
            }
          ]
        }
      },
      { 
        id: 1, 
        name: 'Manual Mute', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 1,
        staffDescription: 'Prevent the player from communicating in chat for a specified duration. Use for chat-related violations.',
        playerDescription: 'You have been muted and cannot use chat.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'reason',
              type: 'textarea',
              label: 'Appeal Reason',
              description: 'Why do you believe this mute should be reviewed?',
              required: true,
              order: 1
            },
            {
              id: 'chat_context',
              type: 'textarea',
              label: 'Chat Context',
              description: 'Provide context about what you said or the situation',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 2, 
        name: 'Manual Ban', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 2,
        staffDescription: 'Temporarily or permanently ban a player from the server. Use for serious violations or repeat offenders.',
        playerDescription: 'You have been banned from the server.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'reason',
              type: 'textarea',
              label: 'Appeal Reason',
              description: 'Why do you believe this ban should be reviewed?',
              required: true,
              order: 1
            },
            {
              id: 'acknowledgment',
              type: 'checkbox',
              label: 'I understand the rules and will follow them',
              description: 'Acknowledge that you understand server rules',
              required: true,
              order: 2
            }
          ]
        }
      },
      { 
        id: 3, 
        name: 'Security Ban', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 3,
        staffDescription: 'Ban for security violations, suspicious activity, or compromised accounts. Usually permanent or long-term.',
        playerDescription: 'You have been banned for security reasons.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'security_explanation',
              type: 'textarea',
              label: 'Security Concern Explanation',
              description: 'Explain why you believe this security ban was issued in error',
              required: true,
              order: 1
            },
            {
              id: 'account_security',
              type: 'textarea',
              label: 'Account Security Measures',
              description: 'What steps have you taken to secure your account?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 4, 
        name: 'Linked Ban', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 4,
        staffDescription: 'Ban applied due to association with another banned account. Use when detecting ban evasion or linked violations.',
        playerDescription: 'You have been banned due to association with another banned account.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'account_relationship',
              type: 'textarea',
              label: 'Account Relationship',
              description: 'Explain your relationship to the linked account',
              required: true,
              order: 1
            },
            {
              id: 'shared_connection',
              type: 'dropdown',
              label: 'Connection Type',
              description: 'How is your account connected to the banned account?',
              required: true,
              options: ['Family member', 'Friend', 'Shared computer', 'Public network', 'Unknown/No connection'],
              order: 2
            }
          ]
        }
      },
      { 
        id: 5, 
        name: 'Blacklist', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 5,
        staffDescription: 'Permanent ban for the most severe violations. Use sparingly for extreme cases that warrant permanent removal.',
        playerDescription: 'You have been permanently blacklisted from the server.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'exceptional_circumstances',
              type: 'textarea',
              label: 'Exceptional Circumstances',
              description: 'Describe any exceptional circumstances that warrant review of this permanent ban',
              required: true,
              order: 1
            },
            {
              id: 'time_since_ban',
              type: 'text',
              label: 'Time Since Ban',
              description: 'How long has it been since you were banned?',
              required: false,
              order: 2
            },
            {
              id: 'behavioral_change',
              type: 'textarea',
              label: 'Behavioral Changes',
              description: 'What have you done to address the behavior that led to this ban?',
              required: false,
              order: 3
            }
          ]
        }
      }
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
    
    // AI Moderation settings
    defaultSettingsMap.set('aiModerationSettings', {
      enableAutomatedActions: true,
      strictnessLevel: 'standard'
    });
    
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

// Get AI moderation settings
router.get('/ai-moderation-settings', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const SettingsModel = req.serverDbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});

    if (!settingsDoc) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const aiSettings = settingsDoc.settings.get('aiModerationSettings') || {
      enableAutomatedActions: true,
      strictnessLevel: 'standard'
    };

    res.json({ success: true, data: aiSettings });
  } catch (error) {
    console.error('Error fetching AI moderation settings:', error);
    res.status(500).json({ error: 'Failed to fetch AI moderation settings' });
  }
});

// Update AI moderation settings
router.put('/ai-moderation-settings', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { enableAutomatedActions, strictnessLevel } = req.body;

    // Validate input
    if (typeof enableAutomatedActions !== 'boolean') {
      return res.status(400).json({ error: 'enableAutomatedActions must be a boolean' });
    }

    if (!['lenient', 'standard', 'strict'].includes(strictnessLevel)) {
      return res.status(400).json({ error: 'strictnessLevel must be lenient, standard, or strict' });
    }

    const SettingsModel = req.serverDbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});

    if (!settingsDoc) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    settingsDoc.settings.set('aiModerationSettings', {
      enableAutomatedActions,
      strictnessLevel
    });

    await settingsDoc.save();

    res.json({ success: true, message: 'AI moderation settings updated successfully' });
  } catch (error) {
    console.error('Error updating AI moderation settings:', error);
    res.status(500).json({ error: 'Failed to update AI moderation settings' });
  }
});

// Apply AI-suggested punishment to a player
router.post('/ai-apply-punishment/:ticketId', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { ticketId } = req.params;
    const { staffName } = req.body;

    // Get the ticket with AI analysis
    const TicketModel = req.serverDbConnection.model('Ticket');
    const ticket = await TicketModel.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const aiAnalysis = ticket.data?.get ? ticket.data.get('aiAnalysis') : ticket.data?.aiAnalysis;
    if (!aiAnalysis || !aiAnalysis.suggestedAction) {
      return res.status(400).json({ error: 'No AI suggestion found for this ticket' });
    }

    if (aiAnalysis.wasAppliedAutomatically) {
      return res.status(400).json({ error: 'Punishment was already applied automatically' });
    }

    // Get the reported player
    const reportedPlayer = ticket.relatedPlayer || ticket.data?.get?.('reportedPlayer') || ticket.data?.reportedPlayer;
    if (!reportedPlayer) {
      return res.status(400).json({ error: 'No reported player found for this ticket' });
    }

    // Update the AI analysis to mark it as manually applied
    aiAnalysis.wasAppliedAutomatically = true; // Mark as applied (even though manually)
    aiAnalysis.appliedBy = staffName;
    aiAnalysis.appliedAt = new Date();

    ticket.data.set('aiAnalysis', aiAnalysis);
    await ticket.save();

    console.log(`[AI Moderation] Manual punishment application approved for ticket ${ticketId} by ${staffName}`);

    res.json({ 
      success: true, 
      message: 'AI-suggested punishment applied successfully',
      punishmentData: {
        punishmentTypeId: aiAnalysis.suggestedAction.punishmentTypeId,
        severity: aiAnalysis.suggestedAction.severity,
        reason: `AI-suggested moderation (applied by ${staffName}) - ${aiAnalysis.analysis}`,
        ticketId: ticketId,
        staffName: staffName
      }
    });
  } catch (error) {
    console.error('Error applying AI-suggested punishment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dismiss AI suggestion for a ticket
router.post('/ai-dismiss-suggestion/:ticketId', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { ticketId } = req.params;
    const { staffName, reason } = req.body;

    // Get the ticket with AI analysis
    const TicketModel = req.serverDbConnection.model('Ticket');
    const ticket = await TicketModel.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const aiAnalysis = ticket.data?.get ? ticket.data.get('aiAnalysis') : ticket.data?.aiAnalysis;
    if (!aiAnalysis) {
      return res.status(400).json({ error: 'No AI analysis found for this ticket' });
    }

    // Mark the suggestion as dismissed
    aiAnalysis.dismissed = true;
    aiAnalysis.dismissedBy = staffName;
    aiAnalysis.dismissedAt = new Date();
    aiAnalysis.dismissalReason = reason || 'No reason provided';

    ticket.data.set('aiAnalysis', aiAnalysis);
    await ticket.save();

    console.log(`[AI Moderation] AI suggestion dismissed for ticket ${ticketId} by ${staffName}`);

    res.json({ 
      success: true, 
      message: 'AI suggestion dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing AI suggestion:', error);
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
          low: { first: { value: 6, unit: 'hours', type: 'mute' }, medium: { value: 1, unit: 'days', type: 'mute' }, habitual: { value: 3, unit: 'days', type: 'mute' } },
          regular: { first: { value: 1, unit: 'days', type: 'mute' }, medium: { value: 3, unit: 'days', type: 'mute' }, habitual: { value: 7, unit: 'days', type: 'mute' } },
          severe: { first: { value: 3, unit: 'days', type: 'mute' }, medium: { value: 7, unit: 'days', type: 'mute' }, habitual: { value: 14, unit: 'days', type: 'mute' } }
        },
        points: { low: 1, regular: 1, severe: 2 },
        staffDescription: 'Inappropriate language, excessive caps, or disruptive chat behavior that violates community standards.',
        playerDescription: 'Public chat channels are reserved for decent messages. Review acceptable public chat decorum here: https://www.server.com/rules#chat',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Provide context about what you said or the chat situation',
              required: true,
              order: 1
            }
          ]
        }
      },
      { 
        id: 9, 
        name: 'Anti Social', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 7,
        durations: {
          low: { first: { value: 3, unit: 'days', type: 'mute' }, medium: { value: 7, unit: 'days', type: 'mute' }, habitual: { value: 14, unit: 'days', type: 'mute' } },
          regular: { first: { value: 7, unit: 'days', type: 'mute' }, medium: { value: 30, unit: 'days', type: 'mute' }, habitual: { value: 90, unit: 'days', type: 'mute' } },
          severe: { first: { value: 30, unit: 'days', type: 'mute' }, medium: { value: 90, unit: 'days', type: 'mute' }, habitual: { value: 180, unit: 'days', type: 'mute' } }
        },
        points: { low: 2, regular: 3, severe: 4 },
        staffDescription: 'Hostile, toxic, or antisocial behavior that creates a negative environment for other players.',
        playerDescription: 'Anti-social and disruptive behavior is strictly prohibited from public channels. If you would not want your mom to hear it, keep it yourself!',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'behavior_explanation',
              type: 'textarea',
              label: 'Behavior Explanation',
              description: 'Explain the behavior that led to this punishment',
              required: true,
              order: 1
            },
            {
              id: 'improvement_plan',
              type: 'textarea',
              label: 'Improvement Plan',
              description: 'How will you improve your behavior going forward?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 10, 
        name: 'Targeting', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 8,
        durations: {
          low: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          regular: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 90, unit: 'days', type: 'ban' }, habitual: { value: 180, unit: 'days', type: 'ban' } },
          severe: { first: { value: 90, unit: 'days', type: 'ban' }, medium: { value: 180, unit: 'days', type: 'ban' }, habitual: { value: 365, unit: 'days', type: 'ban' } }
        },
        points: { low: 4, regular: 6, severe: 10 },
        staffDescription: 'Persistent harassment, bullying, or targeting of specific players with malicious intent.',
        playerDescription: 'You have been banned for targeting and harassing other players.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'targeting_details',
              type: 'textarea',
              label: 'Incident Details',
              description: 'Describe the situation and why you believe this was not targeting',
              required: true,
              order: 1
            },
            {
              id: 'victim_relationship',
              type: 'text',
              label: 'Relationship to Other Player',
              description: 'What is your relationship to the player you allegedly targeted?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 11, 
        name: 'Bad Content', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 9,
        durations: {
          low: { first: { value: 1, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } },
          regular: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          severe: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 60, unit: 'days', type: 'ban' }, habitual: { value: 90, unit: 'days', type: 'ban' } }
        },
        points: { low: 3, regular: 4, severe: 5 },
        staffDescription: 'Inappropriate content including builds, signs, books, or other user-generated content that violates server rules.',
        playerDescription: 'You have been banned for creating inappropriate content on the server.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'content_description',
              type: 'textarea',
              label: 'Content Description',
              description: 'Describe the content that led to this punishment',
              required: true,
              order: 1
            },
            {
              id: 'content_intent',
              type: 'textarea',
              label: 'Content Intent',
              description: 'What was the intended purpose of this content?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 6, 
        name: 'Bad Skin', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 10,
        durations: {
          low: { first: { value: 24, unit: 'hours', type: 'ban' }, medium: { value: 3, unit: 'days', type: 'ban' }, habitual: { value: 7, unit: 'days', type: 'ban' } },
          regular: { first: { value: 2, unit: 'days', type: 'ban' }, medium: { value: 4, unit: 'days', type: 'ban' }, habitual: { value: 10, unit: 'days', type: 'ban' } },
          severe: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } }
        },
        points: { low: 1, regular: 2, severe: 3 },
        staffDescription: 'Inappropriate Minecraft skin that violates community standards or contains offensive imagery.',
        playerDescription: 'You have been banned for using an inappropriate skin. Please change your skin before returning.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'skin_change_confirmation',
              type: 'checkbox',
              label: 'I have changed my skin',
              description: 'Confirm that you have changed to an appropriate skin',
              required: true,
              order: 1
            },
            {
              id: 'skin_explanation',
              type: 'textarea',
              label: 'Skin Explanation',
              description: 'Explain why you believe your skin was appropriate or describe the new skin you are using',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 7, 
        name: 'Bad Name', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 11,
        durations: {
          low: { first: { value: 24, unit: 'hours', type: 'ban' }, medium: { value: 3, unit: 'days', type: 'ban' }, habitual: { value: 7, unit: 'days', type: 'ban' } },
          regular: { first: { value: 2, unit: 'days', type: 'ban' }, medium: { value: 4, unit: 'days', type: 'ban' }, habitual: { value: 10, unit: 'days', type: 'ban' } },
          severe: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } }
        },
        points: { low: 1, regular: 2, severe: 3 },
        staffDescription: 'Inappropriate Minecraft username that violates community standards or contains offensive content.',
        playerDescription: 'You have been banned for using an inappropriate username. Please change your username before returning.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'name_change_confirmation',
              type: 'checkbox',
              label: 'I have changed my username',
              description: 'Confirm that you have changed to an appropriate username',
              required: true,
              order: 1
            },
            {
              id: 'name_explanation',
              type: 'textarea',
              label: 'Username Explanation',
              description: 'Explain why you believe your username was appropriate or describe your new username',
              required: false,
              order: 2
            }
          ]
        }
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
          low: { first: { value: 24, unit: 'hours', type: 'ban' }, medium: { value: 3, unit: 'days', type: 'ban' }, habitual: { value: 7, unit: 'days', type: 'ban' } },
          regular: { first: { value: 2, unit: 'days', type: 'ban' }, medium: { value: 4, unit: 'days', type: 'ban' }, habitual: { value: 10, unit: 'days', type: 'ban' } },
          severe: { first: { value: 4, unit: 'days', type: 'ban' }, medium: { value: 10, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } }
        },
        points: { low: 1, regular: 2, severe: 3 },
        staffDescription: 'Intentionally harming teammates, griefing team structures, or disrupting team gameplay.',
        playerDescription: 'You have been banned for abusing team mechanics or harming your teammates.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'team_situation',
              type: 'textarea',
              label: 'Team Situation',
              description: 'Describe what happened with your team',
              required: true,
              order: 1
            },
            {
              id: 'intent_explanation',
              type: 'textarea',
              label: 'Intent Explanation',
              description: 'Was this intentional or accidental?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 13, 
        name: 'Game Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 13,
        durations: {
          low: { first: { value: 24, unit: 'hours', type: 'ban' }, medium: { value: 3, unit: 'days', type: 'ban' }, habitual: { value: 7, unit: 'days', type: 'ban' } },
          regular: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } },
          severe: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } }
        },
        points: { low: 2, regular: 4, severe: 6 },
        staffDescription: 'Exploiting game mechanics, spawn camping, or other forms of unfair gameplay that ruin the experience for others.',
        playerDescription: 'You have been banned for abusing game mechanics or engaging in unfair gameplay.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'gameplay_details',
              type: 'textarea',
              label: 'Gameplay Details',
              description: 'Describe the specific gameplay incident',
              required: true,
              order: 1
            },
            {
              id: 'rules_understanding',
              type: 'checkbox',
              label: 'I understand the gameplay rules',
              description: 'Acknowledge that you understand fair gameplay rules',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 17, 
        name: 'Systems Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 14,
        durations: {
          low: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } },
          regular: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          severe: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 60, unit: 'days', type: 'ban' } }
        },
        points: { low: 3, regular: 5, severe: 7 },
        staffDescription: 'Exploiting server systems, economy abuse, or manipulating server infrastructure for personal gain.',
        playerDescription: 'You have been banned for abusing server systems or exploiting economic mechanics.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'system_exploitation',
              type: 'textarea',
              label: 'System Exploitation Details',
              description: 'Describe what system you allegedly exploited',
              required: true,
              order: 1
            },
            {
              id: 'economic_impact',
              type: 'textarea',
              label: 'Economic Impact',
              description: 'Did this involve the server economy? How?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 16, 
        name: 'Account Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 15,
        durations: {
          low: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          regular: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 60, unit: 'days', type: 'ban' } },
          severe: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 60, unit: 'days', type: 'ban' }, habitual: { value: 120, unit: 'days', type: 'ban' } }
        },
        points: { low: 4, regular: 6, severe: 8 },
        staffDescription: 'Using multiple accounts for unfair advantage, account sharing, or circumventing punishments.',
        playerDescription: 'You have been banned for account abuse or using multiple accounts improperly.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'account_usage',
              type: 'textarea',
              label: 'Account Usage',
              description: 'Explain how you use your accounts and why this was flagged',
              required: true,
              order: 1
            },
            {
              id: 'family_sharing',
              type: 'checkbox',
              label: 'This account is shared with family members',
              description: 'Check if multiple family members use this account',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 15, 
        name: 'Game Trading', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 16,
        durations: {
          low: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } },
          regular: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          severe: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 60, unit: 'days', type: 'ban' } }
        },
        points: { low: 3, regular: 5, severe: 7 },
        staffDescription: 'Inappropriate trading practices, scamming, or violating trading rules and guidelines.',
        playerDescription: 'You have been banned for violating trading rules or engaging in unfair trading practices.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'trading_details',
              type: 'textarea',
              label: 'Trading Details',
              description: 'Describe the trading situation that led to this punishment',
              required: true,
              order: 1
            },
            {
              id: 'trading_agreement',
              type: 'textarea',
              label: 'Trading Agreement',
              description: 'What was the agreed upon trade?',
              required: false,
              order: 2
            }
          ]
        }
      },
      { 
        id: 14, 
        name: 'Cheating', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 17,
        durations: {
          low: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          regular: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 60, unit: 'days', type: 'ban' } },
          severe: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 60, unit: 'days', type: 'ban' }, habitual: { value: 180, unit: 'days', type: 'ban' } }
        },
        points: { low: 4, regular: 7, severe: 10 },
        staffDescription: 'Using hacks, mods, or other unauthorized software to gain an unfair advantage in gameplay.',
        playerDescription: 'You have been banned for cheating or using unauthorized modifications.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'cheat_denial',
              type: 'textarea',
              label: 'Cheating Explanation',
              description: 'Explain why you believe you were not cheating',
              required: true,
              order: 1
            },
            {
              id: 'software_list',
              type: 'textarea',
              label: 'Software Used',
              description: 'List any mods, software, or tools you were using',
              required: false,
              order: 2
            },
            {
              id: 'false_positive',
              type: 'checkbox',
              label: 'I believe this was a false positive',
              description: 'Check if you think the anti-cheat made an error',
              required: false,
              order: 3
            }
          ]
        }
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
