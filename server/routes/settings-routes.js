const express = require('express');
const router = express.Router();
const { Settings } = require('../models/mongodb-schemas');

// Get all settings
router.get('/api/settings', async (req, res) => {
  try {
    // Get the settings document (there should only be one)
    let settingsDoc = await Settings.findOne({}); // Renamed for clarity
    
    // If no settings document exists, create a default one
    if (!settingsDoc) {
      settingsDoc = await createDefaultSettings();
    }
    
    // Convert to plain object to ensure Map is serialized correctly for the client
    const plainSettings = settingsDoc.toObject();
    res.json(plainSettings); // Send the plain object
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.patch('/api/settings', async (req, res) => {
  try {
    const updatedSettingsPayload = req.body;
    console.log('[Server] Received updatedSettingsPayload:', JSON.stringify(updatedSettingsPayload, null, 2));
    
    // Get existing settings
    let settingsDoc = await Settings.findOne({});
    
    // If no settings document exists, create a default one
    if (!settingsDoc) {
      console.log('[Server] No settings document found, creating default.');
      settingsDoc = await createDefaultSettings();
    } else {
      console.log('[Server] Found existing settings document.');
    }
    
    // Ensure settingsDoc.settings is a Map, initialize if not (should be by schema, but good to be safe)
    if (!(settingsDoc.settings instanceof Map)) {
      console.warn('[Server] settingsDoc.settings was not a Map, initializing.');
      settingsDoc.settings = new Map();
    }

    console.log('[Server] settingsDoc.settings BEFORE update loop:', JSON.stringify(Object.fromEntries(settingsDoc.settings), null, 2));

    for (const key in updatedSettingsPayload) {
      if (Object.prototype.hasOwnProperty.call(updatedSettingsPayload, key)) {
        const value = updatedSettingsPayload[key];
        console.log(`[Server] Setting in settingsDoc.settings: key='${key}', value='${JSON.stringify(value, null, 2).substring(0, 100)}...'`);
        settingsDoc.settings.set(key, value);
      }
    }
    
    console.log('[Server] settingsDoc.settings AFTER update loop:', JSON.stringify(Object.fromEntries(settingsDoc.settings), null, 2));

    try {
      await settingsDoc.save();
      console.log('[Server] settingsDoc.save() successful.');
      // Convert to plain object for the response
      const plainSavedSettings = settingsDoc.toObject();
      res.json(plainSavedSettings);
    } catch (saveError) {
      console.error('[Server] Error during settingsDoc.save():', saveError);
      res.status(500).json({ error: 'Internal server error during save', details: saveError.message });
    }

  } catch (error) {
    console.error('[Server] General error in PATCH /api/settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset settings to default
router.post('/api/settings/reset', async (req, res) => {
  try {
    // Delete existing settings
    await Settings.deleteMany({});
    
    // Create default settings
    const settings = await createDefaultSettings();
    
    res.json(settings);
  } catch (error) {
    console.error('Error resetting settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific setting
router.get('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // Get the settings document
    let settings = await Settings.findOne({});
    
    // If no settings document exists, create a default one
    if (!settings) {
      settings = await createDefaultSettings();
    }
    
    // Get the specific setting
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
router.put('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'No value provided' });
    }
    
    // Get the settings document
    let settings = await Settings.findOne({});
    
    // If no settings document exists, create a default one
    if (!settings) {
      settings = await createDefaultSettings();
    }
    
    // Update the specific setting
    settings.settings.set(key, value);
    await settings.save();
    
    res.json({ key, value });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to create default settings
async function createDefaultSettings() {
  try {
    const defaultSettings = new Map();
    
    // Default punishment types with durations and points
    const punishmentTypes = [
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
          low: { 
            first: { value: 24, unit: 'hours' }, 
            medium: { value: 3, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          regular: { 
            first: { value: 2, unit: 'days' }, 
            medium: { value: 4, unit: 'days' }, 
            habitual: { value: 10, unit: 'days' }
          },
          severe: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          }
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
          low: { 
            first: { value: 24, unit: 'hours' }, 
            medium: { value: 3, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          regular: { 
            first: { value: 2, unit: 'days' }, 
            medium: { value: 4, unit: 'days' }, 
            habitual: { value: 10, unit: 'days' }
          },
          severe: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          }
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
          low: { 
            first: { value: 24, unit: 'hours' }, 
            medium: { value: 2, unit: 'days' }, 
            habitual: { value: 4, unit: 'days' }
          },
          regular: { 
            first: { value: 2, unit: 'days' }, 
            medium: { value: 4, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          severe: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          }
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
          low: { 
            first: { value: 24, unit: 'hours' }, 
            medium: { value: 2, unit: 'days' }, 
            habitual: { value: 4, unit: 'days' }
          },
          regular: { 
            first: { value: 2, unit: 'days' }, 
            medium: { value: 4, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          severe: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          }
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
          low: { 
            first: { value: 2, unit: 'days' }, 
            medium: { value: 4, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          regular: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          },
          severe: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          }
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
          low: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          },
          regular: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          },
          severe: { 
            first: { value: 14, unit: 'days' }, 
            medium: { value: 30, unit: 'days' }, 
            habitual: { value: 60, unit: 'days' }
          }
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
          low: { 
            first: { value: 24, unit: 'hours' }, 
            medium: { value: 3, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          regular: { 
            first: { value: 2, unit: 'days' }, 
            medium: { value: 4, unit: 'days' }, 
            habitual: { value: 10, unit: 'days' }
          },
          severe: { 
            first: { value: 4, unit: 'days' }, 
            medium: { value: 10, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          }
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
          low: { 
            first: { value: 24, unit: 'hours' }, 
            medium: { value: 3, unit: 'days' }, 
            habitual: { value: 7, unit: 'days' }
          },
          regular: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          },
          severe: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          }
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
          low: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          },
          regular: { 
            first: { value: 14, unit: 'days' }, 
            medium: { value: 30, unit: 'days' }, 
            habitual: { value: 60, unit: 'days' }
          },
          severe: { 
            first: { value: 30, unit: 'days' }, 
            medium: { value: 60, unit: 'days' }, 
            habitual: { value: 180, unit: 'days' }
          }
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
          low: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          },
          regular: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          },
          severe: { 
            first: { value: 14, unit: 'days' }, 
            medium: { value: 30, unit: 'days' }, 
            habitual: { value: 60, unit: 'days' }
          }
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
          low: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          },
          regular: { 
            first: { value: 14, unit: 'days' }, 
            medium: { value: 30, unit: 'days' }, 
            habitual: { value: 60, unit: 'days' }
          },
          severe: { 
            first: { value: 30, unit: 'days' }, 
            medium: { value: 60, unit: 'days' }, 
            habitual: { value: 120, unit: 'days' }
          }
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
          low: { 
            first: { value: 3, unit: 'days' }, 
            medium: { value: 7, unit: 'days' }, 
            habitual: { value: 14, unit: 'days' }
          },
          regular: { 
            first: { value: 7, unit: 'days' }, 
            medium: { value: 14, unit: 'days' }, 
            habitual: { value: 30, unit: 'days' }
          },
          severe: { 
            first: { value: 14, unit: 'days' }, 
            medium: { value: 30, unit: 'days' }, 
            habitual: { value: 60, unit: 'days' }
          }
        },
        points: { low: 3, regular: 5, severe: 7 }
      }
    ];
    
    // Status thresholds
    const statusThresholds = {
      gameplay: {
        medium: 5,  // 5+ points = medium offender
        habitual: 10 // 10+ points = habitual offender
      },
      social: {
        medium: 4,  // 4+ points = medium offender
        habitual: 8  // 8+ points = habitual offender
      }
    };
    
    // Add punishment types and status thresholds to settings
    defaultSettings.set('punishmentTypes', punishmentTypes);
    defaultSettings.set('statusThresholds', statusThresholds);
    
    // Available ticket tags
    defaultSettings.set('ticketTags', [
      'bug', 'player', 'chat', 'appeal', 'high-priority', 'needs-review',
      'in-progress', 'resolved', 'won\'t-fix', 'duplicate'
    ]);
    
    // System settings
    defaultSettings.set('system', {
      'maxLoginAttempts': 5,
      'lockoutDuration': 30 * 60 * 1000, // 30 minutes
      'sessionTimeout': 2 * 60 * 60 * 1000, // 2 hours
      'requireAdminApproval': true,
      'requireTwoFactor': true
    });
    
    // Form templates for each ticket type
    defaultSettings.set('ticketForms', {
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
    });
    
    // Create the settings document
    const settings = new Settings({
      settings: defaultSettings
    });
    
    await settings.save();
    return settings;
  } catch (error) {
    console.error('Error creating default settings:', error);
    throw error;
  }
}

module.exports = router;