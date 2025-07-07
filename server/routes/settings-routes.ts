import express, { Request, Response, NextFunction } from 'express';
import { Connection, Document as MongooseDocument, HydratedDocument } from 'mongoose';
import { isAuthenticated } from '../middleware/auth-middleware';
import { checkPermission } from '../middleware/permission-middleware';
import domainRoutes from './domain-routes';
import PunishmentService from '../services/punishment-service';
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
  unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  type: 'mute' | 'ban' | 'permanent mute' | 'permanent ban';
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
    first: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban' | 'permanent mute' | 'permanent ban'; };
    medium: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban' | 'permanent mute' | 'permanent ban'; };
    habitual: { value: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months'; type: 'mute' | 'ban' | 'permanent mute' | 'permanent ban'; };
  };
  singleSeverityPoints?: number; // Points for single severity punishments
  permanentUntilSkinChange?: boolean; // Whether this punishment persists until player changes skin
  permanentUntilUsernameChange?: boolean; // Whether this punishment persists until player changes username
  isAppealable?: boolean; // Whether this punishment type can be appealed
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

interface IAIPunishmentConfig {
  enabled: boolean;
  aiDescription: string;
}

interface IAIModerationSettings {
  enableAutomatedActions: boolean;
  strictnessLevel: 'lenient' | 'standard' | 'strict';
  aiPunishmentConfigs: Record<number, IAIPunishmentConfig>; // Map punishment type ID to AI config
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
    const corePunishmentTypes: IPunishmentType[] = [      { 
        id: 0, 
        name: 'Kick', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 0,
        staffDescription: 'Kick a player.',
        playerDescription: 'BOOT!',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        isAppealable: false,
        appealForm: {
          fields: []
        }
      },      { 
        id: 1, 
        name: 'Manual Mute', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 1,
        staffDescription: 'Manually mute a player.',
        playerDescription: 'You have been silenced.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        isAppealable: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
            }
          ]
        }
      },      { 
        id: 2, 
        name: 'Manual Ban', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 2,
        staffDescription: 'Manually ban a player.',
        playerDescription: 'The ban hammer has spoken.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        isAppealable: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
            }
          ]
        }
      },      { 
        id: 3, 
        name: 'Security Ban', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 3,
        staffDescription: 'Compromised or potentially compromised account.',
        playerDescription: 'Suspicious activity has been detected on your account. Please secure your account and appeal this ban.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        isAppealable: true,
        appealForm: {
          fields: [
            {
              id: 'security_concern',
              type: 'checkbox',
              label: 'I have secured my account',
              description: 'Please confirm that you have changed your password and secured the email associated with your account',
              required: true,
              order: 1
            },
          ]
        }
      },
      { 
        id: 4, 
        name: 'Linked Ban', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 4,
        staffDescription: 'Usually automatically applied due to ban evasion.',
        playerDescription: 'Evading bans through the use of alternate accounts or sharing your account is strictly prohibited. This ban was automatically issued through a high-confidence IP address linking system for ban #{linked-id}.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        isAppealable: true,
        appealForm: {
          fields: [
            {
              id: 'shared_connection',
              type: 'dropdown',
              label: 'Connection Type',
              description: 'How is your account connected to the banned account?',
              required: true,
              options: ['Family member', 'Friend', 'Shared computer', 'Public network', 'Unknown/No connection'],
              order: 1
            },
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 2
            }
          ]
        }
      },      { 
        id: 5, 
        name: 'Blacklist', 
        category: 'Administrative', 
        isCustomizable: false, 
        ordinal: 5,
        staffDescription: 'Remove a player (unappealable).',
        playerDescription: 'You are blacklisted from the server.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        isAppealable: false,
        appealForm: {
          fields: []
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
    
    // Legacy ticket forms - kept for backward compatibility but not used in the new system
    const legacyTicketForms: ITicketForms = {
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
    defaultSettingsMap.set('legacyTicketForms', legacyTicketForms);
    
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
    
    // AI Moderation settings with default enabled punishment types
    defaultSettingsMap.set('aiModerationSettings', {
      enableAutomatedActions: true,
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {
        6: { // Chat Abuse
          enabled: true,
          aiDescription: 'Inappropriate language, excessive caps, spam, or disruptive chat behavior that violates community standards.'
        },
        7: { // Anti Social
          enabled: true,
          aiDescription: 'Hostile, toxic, or antisocial behavior that creates a negative environment for other players.'
        }
      }
    });

    // Default Ticket Forms Configuration (only 3 types needed)
    const defaultTicketForms = {
      bug: {
        fields: [
          {
            id: 'bug_title',
            type: 'text',
            label: 'Bug Title',
            description: 'Brief description of the bug',
            required: true,
            order: 1
          },
          {
            id: 'bug_description',
            type: 'textarea',
            label: 'Detailed Description',
            description: 'Provide a detailed description of the bug you encountered',
            required: true,
            order: 2
          },
          {
            id: 'steps_to_reproduce',
            type: 'textarea',
            label: 'Steps to Reproduce',
            description: 'List the exact steps to reproduce this bug',
            required: true,
            order: 3
          },
          {
            id: 'expected_behavior',
            type: 'textarea',
            label: 'Expected Behavior',
            description: 'What did you expect to happen?',
            required: true,
            order: 4
          },
          {
            id: 'actual_behavior',
            type: 'textarea',
            label: 'Actual Behavior',
            description: 'What actually happened?',
            required: true,
            order: 5
          },
          {
            id: 'game_mode',
            type: 'dropdown',
            label: 'Game Mode',
            description: 'Which game mode were you playing?',
            required: true,
            options: ['Survival', 'Creative', 'Adventure', 'Spectator', 'Other'],
            order: 6
          },
          {
            id: 'server_version',
            type: 'text',
            label: 'Server Version',
            description: 'What version of the server were you on? (if known)',
            required: false,
            order: 7
          },
          {
            id: 'screenshot_evidence',
            type: 'file_upload',
            label: 'Screenshots/Evidence',
            description: 'Upload any screenshots or evidence of the bug',
            required: false,
            order: 8
          }
        ],
        sections: []
      },
      support: {
        fields: [
          {
            id: 'support_category',
            type: 'dropdown',
            label: 'Support Category',
            description: 'What type of support do you need?',
            required: true,
            options: ['Account Issues', 'Payment/Billing', 'Technical Issues', 'Gameplay Help', 'Other'],
            order: 1
          },
          {
            id: 'issue_description',
            type: 'textarea',
            label: 'Issue Description',
            description: 'Describe your issue in detail',
            required: true,
            order: 2
          },
          {
            id: 'previous_attempts',
            type: 'textarea',
            label: 'Previous Attempts',
            description: 'What have you already tried to resolve this issue?',
            required: false,
            order: 3
          },
          {
            id: 'urgency_level',
            type: 'dropdown',
            label: 'Urgency Level',
            description: 'How urgent is this request?',
            required: true,
            options: ['Low', 'Medium', 'High', 'Critical'],
            order: 4
          },
          {
            id: 'additional_info',
            type: 'textarea',
            label: 'Additional Information',
            description: 'Any other relevant information',
            required: false,
            order: 5
          }
        ],
        sections: []
      },
      application: {
        fields: [
          {
            id: 'position_type',
            type: 'dropdown',
            label: 'Position Applying For',
            description: 'Which staff position are you applying for?',
            required: true,
            options: ['Builder', 'Helper', 'Developer'],
            order: 1,
            optionSectionMapping: {
              'Builder': 'builder_section',
              'Helper': 'helper_section',
              'Developer': 'developer_section'
            }
          },
          {
            id: 'real_name',
            type: 'text',
            label: 'Real Name (First Name)',
            description: 'Your real first name',
            required: true,
            order: 2
          },
          {
            id: 'age',
            type: 'text',
            label: 'Age',
            description: 'Your age',
            required: true,
            order: 3
          },
          {
            id: 'timezone',
            type: 'text',
            label: 'Timezone',
            description: 'Your timezone (e.g., EST, PST, GMT)',
            required: true,
            order: 4
          },
          {
            id: 'availability',
            type: 'textarea',
            label: 'Availability',
            description: 'When are you typically available? Include days and hours.',
            required: true,
            order: 5
          },
          {
            id: 'why_apply',
            type: 'textarea',
            label: 'Why are you applying?',
            description: 'Tell us why you want to join our staff team',
            required: true,
            order: 6
          },
          {
            id: 'previous_experience',
            type: 'textarea',
            label: 'Previous Experience',
            description: 'Any relevant previous experience (gaming, moderation, development, etc.)',
            required: true,
            order: 7
          },
          // Builder-specific fields
          {
            id: 'builder_experience',
            type: 'textarea',
            label: 'Building Experience',
            description: 'Describe your building experience and skills',
            required: true,
            order: 8,
            sectionId: 'builder_section'
          },
          {
            id: 'building_style',
            type: 'text',
            label: 'Building Style',
            description: 'What style of building do you specialize in?',
            required: true,
            order: 9,
            sectionId: 'builder_section'
          },
          {
            id: 'portfolio_link',
            type: 'text',
            label: 'Portfolio Link',
            description: 'Link to your building portfolio (optional)',
            required: false,
            order: 10,
            sectionId: 'builder_section'
          },
          // Helper-specific fields
          {
            id: 'moderation_experience',
            type: 'textarea',
            label: 'Moderation Experience',
            description: 'Describe any moderation or community management experience',
            required: true,
            order: 8,
            sectionId: 'helper_section'
          },
          {
            id: 'conflict_resolution',
            type: 'textarea',
            label: 'Conflict Resolution',
            description: 'How would you handle conflicts between players?',
            required: true,
            order: 9,
            sectionId: 'helper_section'
          },
          {
            id: 'player_help_scenario',
            type: 'textarea',
            label: 'Player Help Scenario',
            description: 'A new player asks for help understanding the rules. How would you assist them?',
            required: true,
            order: 10,
            sectionId: 'helper_section'
          },
          // Developer-specific fields
          {
            id: 'programming_languages',
            type: 'text',
            label: 'Programming Languages',
            description: 'What programming languages are you familiar with?',
            required: true,
            order: 8,
            sectionId: 'developer_section'
          },
          {
            id: 'minecraft_dev_experience',
            type: 'textarea',
            label: 'Minecraft Development Experience',
            description: 'Describe your experience with Minecraft plugin/mod development',
            required: true,
            order: 9,
            sectionId: 'developer_section'
          },
          {
            id: 'github_profile',
            type: 'text',
            label: 'GitHub Profile',
            description: 'Link to your GitHub profile (optional)',
            required: false,
            order: 10,
            sectionId: 'developer_section'
          },
          {
            id: 'dev_project_examples',
            type: 'textarea',
            label: 'Project Examples',
            description: 'Describe some projects you have worked on',
            required: true,
            order: 11,
            sectionId: 'developer_section'
          }
        ],
        sections: [
          {
            id: 'builder_section',
            title: 'Builder Application',
            description: 'Additional questions for Builder applicants',
            order: 1,
            showIfFieldId: 'position_type',
            showIfValue: 'Builder'
          },
          {
            id: 'helper_section',
            title: 'Helper Application',
            description: 'Additional questions for Helper applicants',
            order: 2,
            showIfFieldId: 'position_type',
            showIfValue: 'Helper'
          },
          {
            id: 'developer_section',
            title: 'Developer Application',
            description: 'Additional questions for Developer applicants',
            order: 3,
            showIfFieldId: 'position_type',
            showIfValue: 'Developer'
          }
        ]
      }
    };
    defaultSettingsMap.set('ticketForms', defaultTicketForms);

    // Default Quick Responses Configuration
    const defaultQuickResponsesConfig = {
      categories: [
        {
          id: 'chat_report_actions',
          name: 'Chat Report Actions',
          ticketTypes: ['chat_report'],
          order: 1,
          actions: [
            {
              id: 'accept_chat_abuse',
              name: 'Accept - Chat Abuse',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Chat Abuse.',
              order: 1,
              issuePunishment: true,
              punishmentTypeId: 8, // CHAT_ABUSE
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'accept_anti_social',
              name: 'Accept - Anti Social',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Anti Social behavior.',
              order: 2,
              issuePunishment: true,
              punishmentTypeId: 9, // ANTI_SOCIAL
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'reject_insufficient_chat',
              name: 'Reject - Insufficient Evidence',
              message: 'Thank you for submitting this chat report. After reviewing the evidence provided, we need additional evidence to proceed with action.',
              order: 3,
              closeTicket: false,
            },
            {
              id: 'reject_no_violation_chat',
              name: 'Reject - No Violation',
              message: 'Thank you for submitting this chat report. After reviewing the evidence provided, we have determined that this does not violate our community guidelines.',
              order: 4,
              closeTicket: true,
            }
          ]
        },
        {
          id: 'player_report_actions',
          name: 'Player Report Actions',
          ticketTypes: ['player_report'],
          order: 2,
          actions: [
            {
              id: 'accept_team_abuse',
              name: 'Accept - Team Abuse',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Team Abuse.',
              order: 1,
              issuePunishment: true,
              punishmentTypeId: 12, // TEAM_ABUSE
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'accept_game_abuse',
              name: 'Accept - Game Abuse',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Game Abuse.',
              order: 2,
              issuePunishment: true,
              punishmentTypeId: 13, // GAME_ABUSE
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'accept_cheating',
              name: 'Accept - Cheating',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Cheating.',
              order: 3,
              issuePunishment: true,
              punishmentTypeId: 14, // CHEATING
              punishmentSeverity: 'severe',
              closeTicket: true,
            },
            {
              id: 'accept_game_trading',
              name: 'Accept - Game Trading',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Game Trading.',
              order: 4,
              issuePunishment: true,
              punishmentTypeId: 15, // GAME_TRADING
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'accept_account_abuse',
              name: 'Accept - Account Abuse',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Account Abuse.',
              order: 5,
              issuePunishment: true,
              punishmentTypeId: 16, // ACCOUNT_ABUSE
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'accept_systems_abuse',
              name: 'Accept - Systems Abuse',
              message: 'Thank you for creating this report. After careful review, we have accepted this and the reported player will be receiving a punishment for Systems Abuse.',
              order: 6,
              issuePunishment: true,
              punishmentTypeId: 17, // SYSTEMS_ABUSE
              punishmentSeverity: 'regular',
              closeTicket: true,
            },
            {
              id: 'reject_insufficient_player',
              name: 'Reject - Insufficient Evidence',
              message: 'Thank you for submitting this player report. After reviewing the evidence provided, we need additional evidence to proceed with action.',
              order: 7,
              closeTicket: false,
            },
            {
              id: 'reject_no_violation_player',
              name: 'Reject - No Violation',
              message: 'Thank you for submitting this player report. After reviewing the evidence provided, we have determined that this does not violate our community guidelines.',
              order: 8,
              closeTicket: true,
            }
          ]
        },
        {
          id: 'appeal_actions',
          name: 'Appeal Actions',
          ticketTypes: ['appeal'],
          order: 2,
          actions: [
            {
              id: 'pardon_full',
              name: 'Pardon - Full',
              message: 'After reviewing your appeal, we have decided to remove the punishment completely. We apologize for any inconvenience.',
              order: 1,
              appealAction: 'pardon',
              closeTicket: true,
            },
            {
              id: 'reduce_punishment',
              name: 'Reduce Punishment',
              message: 'We have reviewed your appeal and decided to reduce the duration of your punishment. Please check your punishment details for the updated duration.',
              order: 2,
              appealAction: 'reduce',
              closeTicket: true,
            },
            {
              id: 'reject_upheld',
              name: 'Reject - Upheld',
              message: 'After careful consideration of your appeal, we have decided to uphold the original punishment.',
              order: 3,
              appealAction: 'reject',
              closeTicket: true,
            },
            {
              id: 'need_more_info_appeal',
              name: 'Need More Information',
              message: 'We need additional information to process your appeal. Please provide more details about your situation.',
              order: 4,
              closeTicket: false,
            }
          ]
        },
        {
          id: 'application_actions',
          name: 'Staff Application Actions',
          ticketTypes: ['application'],
          order: 3,
          actions: [
            {
              id: 'accept_builder',
              name: 'Accept - Builder',
              message: 'Congratulations! Your Builder application has been accepted. Welcome to the Builder team! You will receive further instructions and permissions shortly.',
              order: 1,
              closeTicket: true,
            },
            {
              id: 'accept_helper',
              name: 'Accept - Helper',
              message: 'Congratulations! Your Helper application has been accepted. Welcome to the Helper team! You will receive further instructions and permissions shortly.',
              order: 2,
              closeTicket: true,
            },
            {
              id: 'accept_developer',
              name: 'Accept - Developer',
              message: 'Congratulations! Your Developer application has been accepted. Welcome to the Developer team! You will receive further instructions and permissions shortly.',
              order: 3,
              closeTicket: true,
            },
            {
              id: 'reject_application',
              name: 'Reject Application',
              message: 'Thank you for your interest in joining our team. Unfortunately, we have decided not to move forward with your application at this time. You may reapply in the future.',
              order: 4,
              closeTicket: true,
            },
            {
              id: 'pending_review',
              name: 'Pending Review',
              message: 'Thank you for your application. We are currently reviewing it and will get back to you soon.',
              order: 5,
              closeTicket: false,
            },
            {
              id: 'interview_scheduled',
              name: 'Interview Scheduled',
              message: 'Your application has progressed to the interview stage. Please check your email for interview details.',
              order: 6,
              closeTicket: false,
            },
            {
              id: 'need_more_info_app',
              name: 'Need More Information',
              message: 'We need additional information about your application. Please provide more details about your experience and qualifications.',
              order: 7,
              closeTicket: false,
            }
          ]
        },
        {
          id: 'bug_actions',
          name: 'Bug Report Actions',
          ticketTypes: ['bug_report'],
          order: 4,
          actions: [
            {
              id: 'completed',
              name: 'Fixed',
              message: 'Thank you for reporting this bug. We have fixed the issue and it will be included in our next update.',
              order: 1,
              closeTicket: true,
            },
            {
              id: 'investigating',
              name: 'Investigating',
              message: 'Thank you for this bug report. We are currently investigating the issue and will provide updates as they become available.',
              order: 2,
              closeTicket: false,
            },
            {
              id: 'need_more_info',
              name: 'Need More Info',
              message: 'Thank you for this bug report. We need additional information to investigate this issue. Please provide more details about how to reproduce this bug.',
              order: 3,
              closeTicket: false,
            },
            {
              id: 'duplicate',
              name: 'Duplicate',
              message: 'This bug has been identified as a duplicate of an existing issue. We appreciate your report and are working on a fix.',
              order: 4,
              closeTicket: true,
            },
            {
              id: 'cannot_reproduce',
              name: 'Cannot Reproduce',
              message: 'We were unable to reproduce this issue. If you continue to experience this problem, please provide additional details.',
              order: 5,
              closeTicket: true,
            }
          ]
        },
        {
          id: 'support_actions',
          name: 'Support Actions',
          ticketTypes: ['support'],
          order: 5,
          actions: [
            {
              id: 'resolved',
              name: 'Resolved',
              message: 'Your support request has been resolved. If you need further assistance, please feel free to create a new ticket.',
              order: 1,
              closeTicket: true,
            },
            {
              id: 'escalated',
              name: 'Escalated',
              message: 'Your support request has been escalated to our specialized team. They will contact you with additional information.',
              order: 2,
              closeTicket: false,
            },
            {
              id: 'need_info_support',
              name: 'Need More Info',
              message: 'We need additional information to assist you with your request. Please provide more details about your issue.',
              order: 3,
              closeTicket: false,
            }
          ]
        },
        {
          id: 'general_actions',
          name: 'General Actions',
          ticketTypes: ['other'],
          order: 6,
          actions: [
            {
              id: 'acknowledge',
              name: 'Acknowledge',
              message: 'Thank you for your message. We have received your ticket and will review it shortly.',
              order: 1,
              closeTicket: false,
            },
            {
              id: 'follow_up',
              name: 'Follow Up',
              message: 'We are following up on your ticket. Please let us know if you have any additional information or questions.',
              order: 2,
              closeTicket: false,
            }
          ]
        }
      ]
    };
    defaultSettingsMap.set('quickResponses', defaultQuickResponsesConfig);
    
    const newSettingsDoc = new SettingsModel({ settings: defaultSettingsMap });
    await newSettingsDoc.save();
    return newSettingsDoc;
  } catch (error) {
    throw error;
  }
}

// Add this helper function after the createDefaultSettings function
async function cleanupOrphanedAIPunishmentConfigs(dbConnection: Connection): Promise<void> {
  try {
    const SettingsModel = dbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});
    
    if (!settingsDoc) {
      return;
    }

    const allPunishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
    const aiSettings = settingsDoc.settings.get('aiModerationSettings') || {
      enableAutomatedActions: true,
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {}
    };

    if (!aiSettings.aiPunishmentConfigs) {
      return;
    }

    // Get valid punishment type IDs
    const validPunishmentTypeIds = new Set(allPunishmentTypes.map((pt: IPunishmentType) => pt.id));
    
    // Find orphaned AI configs
    const orphanedConfigIds = Object.keys(aiSettings.aiPunishmentConfigs)
      .map(id => parseInt(id))
      .filter(id => !validPunishmentTypeIds.has(id));

    if (orphanedConfigIds.length > 0) {
      console.log(`[Settings] Cleaning up ${orphanedConfigIds.length} orphaned AI punishment configs:`, orphanedConfigIds);
      
      // Remove orphaned configs
      orphanedConfigIds.forEach(id => {
        delete aiSettings.aiPunishmentConfigs[id];
      });

      // Save updated settings
      settingsDoc.settings.set('aiModerationSettings', aiSettings);
      await settingsDoc.save();
      
      console.log(`[Settings] Successfully removed orphaned AI configs for punishment types:`, orphanedConfigIds);
    }
  } catch (error) {
    console.error('[Settings] Error cleaning up orphaned AI punishment configs:', error);
  }
}

router.get('/', checkPermission('admin.settings.view'), async (req: Request, res: Response) => {
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

router.patch('/', checkPermission('admin.settings.modify'), async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.modlServer?.serverName);
    }

    if (!settingsDoc) { // Should not happen
        return res.status(500).json({ error: 'Failed to retrieve or create settings document for update' });
    }
    
    // Check if punishment types are being updated
    const updatingPunishmentTypes = 'punishmentTypes' in req.body;
    
    for (const key in req.body) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        settingsDoc.settings.set(key, req.body[key]);
      }
    }
    await settingsDoc.save();
    
    // Clean up orphaned AI punishment configs if punishment types were updated
    if (updatingPunishmentTypes) {
      await cleanupOrphanedAIPunishmentConfigs(req.serverDbConnection!);
    }
    
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

// Unified API Key Management Routes - Moved before generic /:key route to prevent interception

// Get current unified API key (masked for security)
router.get('/api-key', async (req: Request, res: Response) => {
  try {
    console.log('[Unified API Key GET] Request received');
    console.log('[Unified API Key GET] Server name:', req.serverName);
    console.log('[Unified API Key GET] DB connection exists:', !!req.serverDbConnection);
    
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    console.log('[Unified API Key GET] Settings doc found:', !!settingsDoc);
    console.log('[Unified API Key GET] Settings map exists:', !!settingsDoc?.settings);
    
    if (!settingsDoc || !settingsDoc.settings) {
      console.log('[Unified API Key GET] No settings found, returning 404');
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    const apiKey = settingsDoc.settings.get('api_key');
    console.log('[Unified API Key GET] API key exists:', !!apiKey);
    console.log('[Unified API Key GET] API key length:', apiKey ? apiKey.length : 0);
    
    if (!apiKey) {
      return res.json({ 
        hasApiKey: false,
        maskedKey: null
      });
    }
    
    // Return masked key for security (show only first 8 and last 4 characters)
    const maskedKey = apiKey.length > 12 
      ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
      : apiKey; // For very short keys, don't mask
    
    console.log('[Unified API Key GET] Returning masked key:', maskedKey);
    
    res.json({ 
      hasApiKey: true,
      maskedKey: maskedKey
    });
  } catch (error) {
    console.error('[Unified API Key GET] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate new unified API key
router.post('/api-key/generate', async (req: Request, res: Response) => {
  try {
    console.log('[Unified API Key GENERATE] Request received');
    console.log('[Unified API Key GENERATE] Server name:', req.serverName);
    console.log('[Unified API Key GENERATE] DB connection exists:', !!req.serverDbConnection);
    
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    let settingsDoc = await Settings.findOne({});
    
    console.log('[Unified API Key GENERATE] Settings doc found:', !!settingsDoc);
    
    // Create settings document if it doesn't exist
    if (!settingsDoc) {
      console.log('[Unified API Key GENERATE] Creating default settings document');
      settingsDoc = await createDefaultSettings(req.serverDbConnection!, req.serverName);
    }
    
    // Generate new API key
    const newApiKey = generateTicketApiKey();
    console.log('[Unified API Key GENERATE] Generated new API key with length:', newApiKey.length);
    
    // Save to settings
    settingsDoc.settings.set('api_key', newApiKey);
    await settingsDoc.save();
    
    console.log('[Unified API Key GENERATE] Saved new API key to settings');
    
    // Return the full key only once (for copying)
    res.json({ 
      apiKey: newApiKey,
      message: 'New API key generated successfully. Please save this key as it will not be shown again.' 
    });
  } catch (error) {
    console.error('[Unified API Key GENERATE] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get full unified API key (for revealing/copying)
router.get('/api-key/reveal', async (req: Request, res: Response) => {
  try {
    console.log('[Unified API Key REVEAL] Request received');
    console.log('[Unified API Key REVEAL] Server name:', req.serverName);
    
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc || !settingsDoc.settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    const apiKey = settingsDoc.settings.get('api_key');
    
    if (!apiKey) {
      return res.status(404).json({ 
        error: 'API key not found'
      });
    }
    
    // Return the full key
    res.json({ 
      apiKey: apiKey
    });
  } catch (error) {
    console.error('[Unified API Key REVEAL] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revoke unified API key
router.delete('/api-key', async (req: Request, res: Response) => {
  try {
    const Settings = req.serverDbConnection!.model<ISettingsDocument>('Settings');
    const settingsDoc = await Settings.findOne({});
    
    if (!settingsDoc || !settingsDoc.settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }
    
    // Remove the API key
    settingsDoc.settings.delete('api_key');
    await settingsDoc.save();
    
    res.json({ 
      message: 'API key revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy API Key Management Routes (for backward compatibility)

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

// Get AI punishment types (combines existing punishment types with AI configs)
router.get('/ai-punishment-types', async (req: Request, res: Response) => {
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
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {}
    };

    const allPunishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
    
    const aiPunishmentConfigs = aiSettings.aiPunishmentConfigs || {};

    // Combine punishment types with AI configurations
    const aiEnabledTypes = allPunishmentTypes
      .filter((pt: IPunishmentType) => {
        const hasConfig = aiPunishmentConfigs[pt.ordinal];
        const isEnabled = hasConfig && aiPunishmentConfigs[pt.ordinal].enabled;
        return hasConfig && isEnabled;
      })
      .map((pt: IPunishmentType) => ({
        id: pt.id,
        ordinal: pt.ordinal,
        name: pt.name,
        category: pt.category,
        aiDescription: aiPunishmentConfigs[pt.ordinal].aiDescription,
        enabled: true
      }));

    res.json({ success: true, data: aiEnabledTypes });
  } catch (error) {
    console.error('Error fetching AI punishment types:', error);
    res.status(500).json({ error: 'Failed to fetch AI punishment types' });
  }
});

// Add/Enable AI punishment type
router.post('/ai-punishment-types', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { punishmentTypeId, aiDescription = '' } = req.body;

    if (punishmentTypeId === undefined || punishmentTypeId === null) {
      return res.status(400).json({ error: 'punishmentTypeId is required' });
    }

    const SettingsModel = req.serverDbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});

    if (!settingsDoc) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const allPunishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
    
    const punishmentType = allPunishmentTypes.find((pt: IPunishmentType) => pt.ordinal === punishmentTypeId);

    if (!punishmentType) {
      return res.status(404).json({ error: 'Punishment type not found. It may have been deleted. Please refresh and try again.' });
    }

    if (!punishmentType.isCustomizable) {
      return res.status(400).json({ error: 'Only customizable punishment types can be enabled for AI moderation' });
    }

    const aiSettings = settingsDoc.settings.get('aiModerationSettings') || {
      enableAutomatedActions: true,
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {}
    };

    if (aiSettings.aiPunishmentConfigs?.[punishmentTypeId]?.enabled) {
      return res.status(409).json({ error: 'Punishment type is already enabled for AI moderation' });
    }

    // Create a new AI settings object to avoid mutation issues with Mongoose change detection
    const newAiSettings = {
      ...aiSettings,
      aiPunishmentConfigs: {
        ...(aiSettings.aiPunishmentConfigs || {}),
        [punishmentTypeId]: {
          enabled: true,
          aiDescription: aiDescription,
        },
      },
    };

    settingsDoc.settings.set('aiModerationSettings', newAiSettings);
    settingsDoc.markModified('settings');
    
    await settingsDoc.save();

    // Verify the save by re-reading the document
    const verificationDoc = await SettingsModel.findOne({});
    const verificationSettings = verificationDoc?.settings.get('aiModerationSettings');

    const responseData = {
      id: punishmentType.id,
      ordinal: punishmentType.ordinal,
      name: punishmentType.name,
      category: punishmentType.category,
      aiDescription: aiDescription,
      enabled: true
    };

    res.json({ success: true, message: 'AI punishment type enabled successfully', data: responseData });
  } catch (error) {
    console.error('Error enabling AI punishment type:', error);
    res.status(500).json({ error: 'Failed to enable AI punishment type' });
  }
});

// Update AI punishment type configuration
router.put('/ai-punishment-types/:id', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const punishmentTypeId = parseInt(req.params.id);
    const { aiDescription, enabled } = req.body;

    if (isNaN(punishmentTypeId)) {
      return res.status(400).json({ error: 'Invalid punishment type ID' });
    }

    const SettingsModel = req.serverDbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});

    if (!settingsDoc) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const allPunishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
    const punishmentType = allPunishmentTypes.find((pt: IPunishmentType) => pt.ordinal === punishmentTypeId);

    if (!punishmentType) {
      // Clean up orphaned config and return error
      const aiSettings = settingsDoc.settings.get('aiModerationSettings') || {
        enableAutomatedActions: true,
        strictnessLevel: 'standard',
        aiPunishmentConfigs: {}
      };
      
      if (aiSettings.aiPunishmentConfigs?.[punishmentTypeId]) {
        delete aiSettings.aiPunishmentConfigs[punishmentTypeId];
        settingsDoc.settings.set('aiModerationSettings', aiSettings);
        await settingsDoc.save();
      }
      
      return res.status(404).json({ error: 'Punishment type not found. It may have been deleted. The configuration has been cleaned up.' });
    }

    const aiSettings = settingsDoc.settings.get('aiModerationSettings') || {
      enableAutomatedActions: true,
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {}
    };

    // Create a new AI settings object to avoid mutation issues
    const newAiSettings = {
      ...aiSettings,
      aiPunishmentConfigs: {
        ...(aiSettings.aiPunishmentConfigs || {}),
        [punishmentTypeId]: {
          ...(aiSettings.aiPunishmentConfigs?.[punishmentTypeId] || { enabled: false, aiDescription: '' }),
          ...(aiDescription !== undefined && { aiDescription }),
          ...(enabled !== undefined && { enabled }),
        },
      },
    };

    settingsDoc.settings.set('aiModerationSettings', newAiSettings);
    settingsDoc.markModified('settings');
    await settingsDoc.save();

    const responseData = {
      id: punishmentType.id,
      ordinal: punishmentType.ordinal,
      name: punishmentType.name,
      category: punishmentType.category,
      aiDescription: newAiSettings.aiPunishmentConfigs[punishmentTypeId].aiDescription,
      enabled: newAiSettings.aiPunishmentConfigs[punishmentTypeId].enabled
    };

    res.json({ 
      success: true, 
      message: 'AI punishment type updated successfully', 
      data: responseData
    });
  } catch (error) {
    console.error('Error updating AI punishment type:', error);
    res.status(500).json({ error: 'Failed to update AI punishment type' });
  }
});

// Remove/Disable AI punishment type
router.delete('/ai-punishment-types/:id', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const punishmentTypeId = parseInt(req.params.id);

    if (isNaN(punishmentTypeId)) {
      return res.status(400).json({ error: 'Invalid punishment type ID' });
    }

    const SettingsModel = req.serverDbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});

    if (!settingsDoc) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const aiSettings = settingsDoc.settings.get('aiModerationSettings') || {
      enableAutomatedActions: true,
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {}
    };

    // Check if configuration exists
    if (!aiSettings.aiPunishmentConfigs?.[punishmentTypeId]) {
      return res.status(404).json({ error: 'AI punishment configuration not found' });
    }

    // Create new object with the property removed to avoid mutation
    const { [punishmentTypeId]: _, ...remainingConfigs } = aiSettings.aiPunishmentConfigs;
    const newAiSettings = {
        ...aiSettings,
        aiPunishmentConfigs: remainingConfigs
    };

    settingsDoc.settings.set('aiModerationSettings', newAiSettings);
    settingsDoc.markModified('settings');
    await settingsDoc.save();

    res.json({ success: true, message: 'AI punishment type disabled successfully' });
  } catch (error) {
    console.error('Error disabling AI punishment type:', error);
    res.status(500).json({ error: 'Failed to disable AI punishment type' });
  }
});

// Get available punishment types for adding to AI (excludes already enabled ones)
router.get('/available-punishment-types', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const SettingsModel = req.serverDbConnection.model<ISettingsDocument>('Settings');
    const settingsDoc = await SettingsModel.findOne({});

    if (!settingsDoc) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    const allPunishmentTypes = settingsDoc.settings.get('punishmentTypes') || [];
    const aiSettings = settingsDoc.settings.get('aiModerationSettings') || { aiPunishmentConfigs: {} };
    const aiPunishmentConfigs = aiSettings.aiPunishmentConfigs || {};
    
    // Filter out punishment types that are already enabled for AI and only include customizable ones
    const availableTypes = allPunishmentTypes
      .filter((pt: IPunishmentType) => 
        pt.isCustomizable && (!aiPunishmentConfigs[pt.ordinal] || !aiPunishmentConfigs[pt.ordinal].enabled)
      )
      .map((pt: IPunishmentType) => ({
        id: pt.id,
        ordinal: pt.ordinal,
        name: pt.name,
        category: pt.category
      }));

    res.json({ success: true, data: availableTypes });
  } catch (error) {
    console.error('Error fetching available punishment types:', error);
    res.status(500).json({ error: 'Failed to fetch available punishment types' });
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

    const currentSettings = settingsDoc.settings.get('aiModerationSettings') || {
      enableAutomatedActions: true,
      strictnessLevel: 'standard',
      aiPunishmentConfigs: {}
    };

    // Update only the specified fields, preserving aiPunishmentConfigs
    settingsDoc.settings.set('aiModerationSettings', {
      ...currentSettings,
      enableAutomatedActions,
      strictnessLevel
    });

    await settingsDoc.save();

    // Clean up any orphaned AI punishment configs
    await cleanupOrphanedAIPunishmentConfigs(req.serverDbConnection);

    res.json({ success: true, message: 'AI moderation settings updated successfully' });
  } catch (error) {
    console.error('Error updating AI moderation settings:', error);
    res.status(500).json({ error: 'Failed to update AI moderation settings' });
  }
});

// Manual cleanup endpoint for orphaned AI punishment configurations
router.post('/cleanup-ai-configs', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    await cleanupOrphanedAIPunishmentConfigs(req.serverDbConnection);
    
    res.json({ 
      success: true, 
      message: 'AI punishment configuration cleanup completed successfully' 
    });
  } catch (error) {
    console.error('Error during AI config cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup AI configurations' });
  }
});

// Apply AI-suggested punishment to a player
router.post('/ai-apply-punishment/:ticketId', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { ticketId } = req.params;
    
    // Get staff information from session (more secure than request body)
    if (!req.currentUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const staffName = req.currentUser.username;
    const staffRole = req.currentUser.role;

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
      return res.status(400).json({ error: 'Punishment was already applied' });
    }

    // Get the reported player identifier (prefer UUID, fallback to name)
    const reportedPlayerUuid = ticket.reportedPlayerUuid || ticket.data?.get?.('reportedPlayerUuid') || ticket.data?.reportedPlayerUuid;
    const reportedPlayer = ticket.reportedPlayer || ticket.data?.get?.('reportedPlayer') || ticket.data?.reportedPlayer;
    const playerIdentifier = reportedPlayerUuid || reportedPlayer;

    if (!playerIdentifier) {
      return res.status(400).json({ error: 'No reported player found for this ticket' });
    }

    // Initialize punishment service and apply the punishment
    const punishmentService = new PunishmentService(req.serverDbConnection);
    const punishmentResult = await punishmentService.applyPunishment(
      playerIdentifier,
      aiAnalysis.suggestedAction.punishmentTypeId,
      aiAnalysis.suggestedAction.severity,
      `AI-suggested moderation (applied by ${staffName}) - ${aiAnalysis.analysis}`,
      ticketId,
      staffName
    );

    if (!punishmentResult.success) {
      return res.status(500).json({ 
        error: `Failed to apply punishment: ${punishmentResult.error}` 
      });
    }

    // Update the AI analysis to mark it as manually applied
    aiAnalysis.wasAppliedAutomatically = true; // Mark as applied (even though manually)
    aiAnalysis.appliedBy = staffName;
    aiAnalysis.appliedByRole = staffRole;
    aiAnalysis.appliedAt = new Date();
    aiAnalysis.appliedPunishmentId = punishmentResult.punishmentId;

    ticket.data.set('aiAnalysis', aiAnalysis);
    await ticket.save();

    console.log(`[AI Moderation] Manual punishment application approved for ticket ${ticketId} by ${staffName} (${staffRole}), punishment ID: ${punishmentResult.punishmentId}`);

    res.json({ 
      success: true, 
      message: 'AI-suggested punishment applied successfully',
      punishmentId: punishmentResult.punishmentId,
      punishmentData: {
        punishmentTypeId: aiAnalysis.suggestedAction.punishmentTypeId,
        severity: aiAnalysis.suggestedAction.severity,
        reason: `AI-suggested moderation (applied by ${staffName}) - ${aiAnalysis.analysis}`,
        ticketId: ticketId,
        staffName: staffName,
        staffRole: staffRole
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
    const { reason } = req.body; // Only accept reason from body, not staff name
    
    // Get staff information from session (more secure than request body)
    if (!req.currentUser) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const staffName = req.currentUser.username;
    const staffRole = req.currentUser.role;

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

    if (aiAnalysis.wasAppliedAutomatically) {
      return res.status(400).json({ error: 'Cannot dismiss - punishment was already applied' });
    }

    if (aiAnalysis.dismissed) {
      return res.status(400).json({ error: 'AI suggestion was already dismissed' });
    }

    // Mark the suggestion as dismissed
    aiAnalysis.dismissed = true;
    aiAnalysis.dismissedBy = staffName;
    aiAnalysis.dismissedByRole = staffRole;
    aiAnalysis.dismissedAt = new Date();
    aiAnalysis.dismissalReason = reason || 'No reason provided';

    ticket.data.set('aiAnalysis', aiAnalysis);
    await ticket.save();

    console.log(`[AI Moderation] AI suggestion dismissed for ticket ${ticketId} by ${staffName} (${staffRole}). Reason: ${aiAnalysis.dismissalReason}`);

    res.json({ 
      success: true, 
      message: 'AI suggestion dismissed successfully'
    });
  } catch (error) {
    console.error('Error dismissing AI suggestion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get AI analysis for a specific ticket
router.get('/ai-analysis/:ticketId', async (req: Request, res: Response) => {
  try {
    if (!req.serverDbConnection) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { ticketId } = req.params;

    // Get the ticket with AI analysis
    const TicketModel = req.serverDbConnection.model('Ticket');
    const ticket = await TicketModel.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const aiAnalysis = ticket.data?.get ? ticket.data.get('aiAnalysis') : ticket.data?.aiAnalysis;
    
    if (!aiAnalysis) {
      return res.status(404).json({ error: 'No AI analysis found for this ticket' });
    }

    res.json({ 
      success: true, 
      data: aiAnalysis
    });
  } catch (error) {
    console.error('Error fetching AI analysis:', error);
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

router.put('/:key', checkPermission('admin.settings.modify'), async (req: Request<{ key: string }, {}, { value: any }>, res: Response) => {
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
    
    // Clean up orphaned AI punishment configs if punishment types were updated
    if (req.params.key === 'punishmentTypes') {
      await cleanupOrphanedAIPunishmentConfigs(req.serverDbConnection!);
    }
    
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
        staffDescription: 'Inappropriate language, excessive caps, or disruptive chat behavior.',
        playerDescription: 'Public chat channels are reserved for decent messages. Review acceptable public chat decorum here: https://www.server.com/rules#chat',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
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
        staffDescription: 'Hostile, toxic, or antisocial behavior that creates a negative environment.',
        playerDescription: 'Anti-social and disruptive behavior is strictly prohibited from public channels. If you would not want your mom to hear it, keep it yourself!',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
        playerDescription: 'This server has a zero tolerance policy on targeting individuals regardless of the basis or medium. This policy encompasses Harassment, Torment, Threats, and Cyber attacks.',
        canBeAltBlocking: true,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
        staffDescription: 'Inappropriate content including builds, signs, books, or other user-generated content.',
        playerDescription: 'Creating obscene, insensitive, or hateful content in-game is strictly prohibited. This extends to builds, books, item-names, name-tags, and signs.',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
            }
          ]
        }
      },      { 
        id: 6, 
        name: 'Bad Skin', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 10,
        customPoints: 2,
        staffDescription: 'Inappropriate Minecraft skin that contains offensive imagery.',
        playerDescription: 'Please help us maintain a safe environment for players of all ages and backgrounds by refraining from the use of obscene/insensitive skins. Change your skin at https://www.minecraft.net',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        permanentUntilSkinChange: true,
        appealForm: {
          fields: [
            {
              id: 'skin_change_confirmation',
              type: 'checkbox',
              label: 'I understand that this ban will be automatically lifted if I change my skin',
              description: 'Only submit this appeal if you believe your skin is wrongfully banned.',
              required: true,
              order: 1
            },
            {
              id: 'skin_explanation',
              type: 'textarea',
              label: 'Skin Explanation',
              description: 'Explain why you believe your skin is appropriate',
              required: true,
              order: 2
            }
          ]
        }
      },      { 
        id: 7, 
        name: 'Bad Name', 
        category: 'Social', 
        isCustomizable: true, 
        ordinal: 11,
        customPoints: 2,
        staffDescription: 'Inappropriate Minecraft username that contains offensive content.',
        playerDescription: 'Please help us maintain a safe environment for players of all ages and backgrounds by refraining from the use of obscene/insensitive usernames. Change your username at https://www.minecraft.net',
        canBeAltBlocking: false,
        canBeStatWiping: false,
        permanentUntilUsernameChange: true,
        appealForm: {
          fields: [
            {
              id: 'name_change_confirmation',
              type: 'checkbox',
              label: 'I understand that this ban will be automatically lifted if I change my skin',
              description: 'Only submit this appeal if you believe your skin is wrongfully banned.',
              required: true,
              order: 1
            },
            {
              id: 'name_explanation',
              type: 'textarea',
              label: 'Name Explanation',
              description: 'Explain why you believe your name is appropriate',
              required: true,
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
          low: { first: { value: 6, unit: 'hours', type: 'ban' }, medium: { value: 12, unit: 'hours', type: 'ban' }, habitual: { value: 3, unit: 'days', type: 'ban' } },
          regular: { first: { value: 12, unit: 'hours', type: 'ban' }, medium: { value: 3, unit: 'days', type: 'ban' }, habitual: { value: 7, unit: 'days', type: 'ban' } },
          severe: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 7, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } }
        },
        points: { low: 2, regular: 2, severe: 3 },
        staffDescription: 'Intentionally harming teammates, cross-teaming, or aiding cheaters.',
        playerDescription: 'Please be considerate to fellow players by not team-griefing, aiding cheaters, or cross-teaming.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
          low: { first: { value: 1, unit: 'days', type: 'ban' }, medium: { value: 3, unit: 'days', type: 'ban' }, habitual: { value: 7, unit: 'days', type: 'ban' } },
          regular: { first: { value: 7, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 14, unit: 'days', type: 'ban' } },
          severe: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 90, unit: 'days', type: 'ban' } }
        },
        points: { low: 2, regular: 3, severe: 5 },
        staffDescription: 'Violating game specific rules for fair play.',
        playerDescription: 'Violating game specific rules for competitive fair-play. It is your responsibility to be aware of and abide by all network-wide and game-specific rules.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
          regular: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 90, unit: 'days', type: 'ban' } },
          severe: { first: { value: 90, unit: 'days', type: 'ban' }, medium: { value: 180, unit: 'days', type: 'ban' }, habitual: { value: 365, unit: 'days', type: 'ban' } }
        },
        points: { low: 2, regular: 3, severe: 5 },
        staffDescription: 'Abusing server functions by opening redundant tickets, creating lag machines, etc.',
        playerDescription: 'Using server systems in an unintended and harmful way is strictly prohibited. This encompasses lag machines, ticket spam, etc.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
            }
          ]
        }
      },
      { 
        id: 16, 
        name: 'Account Abuse', 
        category: 'Gameplay', 
        isCustomizable: true, 
        ordinal: 15,        durations: {
          low: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 60, unit: 'days', type: 'ban' } },
          regular: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 90, unit: 'days', type: 'ban' }, habitual: { value: 180, unit: 'days', type: 'ban' } },
          severe: { first: { value: 0, unit: 'days', type: 'permanent ban' }, medium: { value: 0, unit: 'days', type: 'permanent ban' }, habitual: { value: 0, unit: 'days', type: 'permanent ban' } }
        },
        points: { low: 4, regular: 6, severe: 10 },
        staffDescription: 'Account sharing, alt-account boosting, selling/trading accounts.',
        playerDescription: 'Misuse of accounts for the purposes of financial or levelling gain is prohibited. This encompasses account sharing, trading, selling and boosting through the use of alternate accounts.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
          low: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 30, unit: 'days', type: 'ban' }, habitual: { value: 60, unit: 'days', type: 'ban' } },
          regular: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 90, unit: 'days', type: 'ban' }, habitual: { value: 180, unit: 'days', type: 'ban' } },
          severe: { first: { value: 0, unit: 'days', type: 'permanent ban' }, medium: { value: 0, unit: 'days', type: 'permanent ban' }, habitual: { value: 0, unit: 'days', type: 'permanent ban' } }
        },
        points: { low: 4, regular: 6, severe: 10 },
        staffDescription: 'Trading or selling in-game items, content, or services on unauthorized third-party platforms.',
        playerDescription: 'Trading or selling in-game items, content, or services on unauthorized third-party platforms is strictly prohibited.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
          low: { first: { value: 3, unit: 'days', type: 'ban' }, medium: { value: 14, unit: 'days', type: 'ban' }, habitual: { value: 30, unit: 'days', type: 'ban' } },
          regular: { first: { value: 14, unit: 'days', type: 'ban' }, medium: { value: 60, unit: 'days', type: 'ban' }, habitual: { value: 180, unit: 'days', type: 'ban' } },
          severe: { first: { value: 30, unit: 'days', type: 'ban' }, medium: { value: 90, unit: 'days', type: 'ban' }, habitual: { value: 0, unit: 'days', type: 'permanent ban' } }
        },
        points: { low: 5, regular: 7, severe: 9 },
        staffDescription: 'Using hacks, mods, exploits, or other software to gain an unfair advantage.',
        playerDescription: 'Cheating through the use of client-side modifications or game exploits to gain an unfair advantage over other players is strictly prohibited.',
        canBeAltBlocking: true,
        canBeStatWiping: true,
        appealForm: {
          fields: [
            {
              id: 'why',
              type: 'textarea',
              label: 'Why should this punishment be amended?',
              description: 'Please provide context and any relevant information to support your appeal',
              required: true,
              order: 1
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
