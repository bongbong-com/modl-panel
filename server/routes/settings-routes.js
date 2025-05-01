const express = require('express');
const router = express.Router();
const { Settings } = require('../models/mongodb-schemas');

// Get all settings
router.get('/api/settings', async (req, res) => {
  try {
    // Get the settings document (there should only be one)
    let settings = await Settings.findOne({});
    
    // If no settings document exists, create a default one
    if (!settings) {
      settings = await createDefaultSettings();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.patch('/api/settings', async (req, res) => {
  try {
    const { settings: updatedSettings } = req.body;
    
    if (!updatedSettings) {
      return res.status(400).json({ error: 'No settings provided' });
    }
    
    // Get existing settings
    let settings = await Settings.findOne({});
    
    // If no settings document exists, create a default one
    if (!settings) {
      settings = await createDefaultSettings();
    }
    
    // Update settings
    for (const [key, value] of Object.entries(updatedSettings)) {
      settings.settings.set(key, value);
    }
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
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
    
    // Default punishment durations (in milliseconds)
    defaultSettings.set('defaultPunishmentDurations', {
      'Chat Abuse': 7 * 24 * 60 * 60 * 1000, // 7 days
      'Game Abuse': 14 * 24 * 60 * 60 * 1000, // 14 days
      'Cheating': 30 * 24 * 60 * 60 * 1000, // 30 days
      'Bad Name': 0, // Until fixed
      'Bad Skin': 0, // Until fixed
      'Security Ban': 3 * 24 * 60 * 60 * 1000 // 3 days
    });
    
    // Available punishment types
    defaultSettings.set('punishmentTypes', [
      'Kick', 'Blacklist', 'Security Ban', 'Linked Ban', 'Bad Skin', 'Bad Name',
      'Chat Abuse', 'Anti Social', 'Targeting', 'Bad Content', 'Team Abuse',
      'Game Abuse', 'Cheating', 'Game Trading', 'Account Abuse', 'Scamming',
      'Manual Mute', 'Manual Ban'
    ]);
    
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