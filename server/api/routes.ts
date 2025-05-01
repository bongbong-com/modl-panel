import express from 'express';
import { Player, Staff, Ticket, Log, Settings } from '../models/mongodb-schemas';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = express.Router();

// ========================= PLAYER ROUTES =========================

// Get all players
router.get('/api/players', async (req, res) => {
  try {
    const players = await Player.find({});
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get player by UUID
router.get('/api/players/:uuid', async (req, res) => {
  try {
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json(player);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new player
router.post('/api/players', async (req, res) => {
  try {
    const { minecraftUuid, username } = req.body;
    
    // Check if player already exists
    const existingPlayer = await Player.findOne({ minecraftUuid });
    if (existingPlayer) {
      return res.status(400).json({ error: 'Player already exists' });
    }
    
    // Create new player
    const player = new Player({
      _id: uuidv4(),
      minecraftUuid,
      usernames: [{ username, date: new Date() }],
      notes: [],
      ipList: [],
      punishments: [],
      pendingNotifications: []
    });
    
    await player.save();
    res.status(201).json(player);
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================= TICKET ROUTES =========================

// Get all tickets
router.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await Ticket.find({});
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ticket by ID
router.get('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new ticket
router.post('/api/tickets', async (req, res) => {
  try {
    const { category, creator, tags, data } = req.body;
    
    // Generate a unique ID with the format CATEGORY-[6 digit random numeric]
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const ticketId = `${category}-${randomDigits}`;
    
    const ticket = new Ticket({
      _id: ticketId,
      tags: tags || [],
      created: new Date(),
      creator,
      notes: [],
      replies: [],
      data: data || {}
    });
    
    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================= APPEAL ROUTES =========================

// Get appeals by punishment ID
router.get('/api/appeals/punishment/:id', async (req, res) => {
  try {
    // Look for tickets with this punishment ID in data
    const appeals = await Ticket.find({ 'data.punishmentId': req.params.id });
    
    if (!appeals || appeals.length === 0) {
      return res.status(404).json({ error: 'No appeals found for this punishment' });
    }
    
    res.json(appeals);
  } catch (error) {
    console.error('Error fetching appeals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new appeal
router.post('/api/appeals', async (req, res) => {
  try {
    const { 
      punishmentId, 
      playerUuid, 
      email,
      reason,
      evidence,
      additionalData
    } = req.body;
    
    // First check if the punishment exists
    const player = await Player.findOne({ 'punishments.id': punishmentId });
    
    if (!player) {
      return res.status(404).json({ error: 'Punishment not found' });
    }
    
    // Find the punishment
    const punishment = player.punishments.find(p => p.id === punishmentId);
    
    if (!punishment) {
      return res.status(404).json({ error: 'Punishment not found' });
    }
    
    // Check if an appeal already exists for this punishment
    const existingAppeal = await Ticket.findOne({ 'data.punishmentId': punishmentId });
    
    if (existingAppeal) {
      return res.status(400).json({ error: 'An appeal already exists for this punishment' });
    }
    
    // Generate a unique ID with the format APPEAL-[6 digit random numeric]
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const appealId = `APPEAL-${randomDigits}`;
    
    // Create the appeal data map
    const dataMap = new Map();
    dataMap.set('punishmentId', punishmentId);
    dataMap.set('playerUuid', playerUuid);
    dataMap.set('email', email);
    dataMap.set('status', 'Pending Review');
    
    // Add any additional data fields
    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        dataMap.set(key, value);
      }
    }
    
    // Prepare the appeal ticket
    const appeal = new Ticket({
      _id: appealId,
      tags: ['appeal', punishment.type],
      created: new Date(),
      creator: playerUuid,
      notes: [],
      data: dataMap
    });
    
    // Format the initial message with all provided data
    let formattedContent = 'Appeal Details:\n\n';
    
    if (reason) {
      formattedContent += `Appeal Reason: ${reason}\n`;
    }
    
    if (evidence) {
      formattedContent += `Evidence: ${evidence}\n`;
    }
    
    // Add any checkbox values or other fields from additionalData
    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        // Format boolean values as Yes/No
        const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value;
        formattedContent += `${key}: ${displayValue}\n`;
      }
    }
    
    formattedContent += `\nContact Email: ${email}`;
    
    // Create the appeal without replies first
    await appeal.save();
    
    // Then add replies after saving
    appeal.replies.push({
      name: player.usernames[player.usernames.length - 1]?.username || 'Player',
      content: formattedContent,
      type: 'player',
      created: new Date(),
      staff: false
    });
    
    appeal.replies.push({
      name: 'System',
      content: 'Your appeal has been received and will be reviewed by our moderation team.',
      type: 'system',
      created: new Date(),
      staff: false
    });
    
    // Add reference to the punishment
    punishment.attachedTicketIds.push(appealId);
    
    // Save both the appeal and the updated player
    await appeal.save();
    await player.save();
    
    res.status(201).json(appeal);
  } catch (error) {
    console.error('Error creating appeal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================= STAFF ROUTES =========================

// Get all staff
router.get('/api/staff', async (req, res) => {
  try {
    // Exclude sensitive fields like 2FA secret and passkey details
    const staff = await Staff.find({}).select('-twoFaSecret -passkey.publicKey -passkey.credentialId -passkey.signCount');
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new staff member
router.post('/api/staff', async (req, res) => {
  try {
    const { email, username, profilePicture, admin } = req.body;
    
    // Check if staff member already exists
    const existingStaff = await Staff.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingStaff) {
      return res.status(400).json({ error: 'Staff member with this email or username already exists' });
    }
    
    // Generate a random 2FA secret (hex encoded for compatibility)
    const twoFaSecret = crypto.randomBytes(10).toString('hex');
    
    const staff = new Staff({
      email,
      username,
      profilePicture,
      admin: admin || false,
      twoFaSecret
    });
    
    await staff.save();
    
    // Return everything except the 2FA secret
    const safeStaff = staff.toObject();
    delete safeStaff.twoFaSecret;
    
    res.status(201).json(safeStaff);
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================= LOG ROUTES =========================

// Get all logs
router.get('/api/logs', async (req, res) => {
  try {
    const logs = await Log.find({}).sort({ created: -1 });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new log
router.post('/api/logs', async (req, res) => {
  try {
    const { description } = req.body;
    
    const log = new Log({
      description,
      created: new Date()
    });
    
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================= SETTINGS ROUTES =========================

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

// Create system log
export async function createSystemLog(description: string) {
  try {
    const log = new Log({
      description,
      created: new Date()
    });
    
    await log.save();
    return log;
  } catch (error) {
    console.error('Error creating system log:', error);
    return null;
  }
}

export default router;