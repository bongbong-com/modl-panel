const express = require('express');
const router = express.Router();
const { Player } = require('../models/mongodb-schemas');
const { v4: uuidv4 } = require('uuid');

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

// Log a player in
router.post('/api/players/login', async (req, res) => {
  try {
    const { minecraftUuid, username, ipAddress } = req.body;

    // Check if player already exists
    const existingPlayer = await Player.findOne({ minecraftUuid });
    if (existingPlayer) {
      
      const existingIp = player.ipList.find(ip => ip.ipAddress === ipAddress);
      if (existingIp) {
        // Just update the login dates
        existingIp.logins.push(new Date());

        
      } else {
        // Add new IP
        player.ipList.push({
          ipAddress,
          country,
          region,
          asn,
          firstLogin: new Date(),
          logins: [new Date()]
        });
      }
      
      return existingPlayer;
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

// Add username to player
router.post('/api/players/:uuid/usernames', async (req, res) => {
  try {
    const { username } = req.body;
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    player.usernames.push({ username, date: new Date() });
    await player.save();
    
    res.json(player);
  } catch (error) {
    console.error('Error adding username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add note to player
router.post('/api/players/:uuid/notes', async (req, res) => {
  try {
    const { text, issuerName } = req.body;
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    player.notes.push({ text, issuerName, date: new Date() });
    await player.save();
    
    res.json(player);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add IP address to player
router.post('/api/players/:uuid/ips', async (req, res) => {
  try {
    const { ipAddress, country, region, asn } = req.body;
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Check if IP already exists for this player
    const existingIp = player.ipList.find(ip => ip.ipAddress === ipAddress);
    if (existingIp) {
      // Just update the login dates
      existingIp.logins.push(new Date());
    } else {
      // Add new IP
      player.ipList.push({
        ipAddress,
        country,
        region,
        asn,
        firstLogin: new Date(),
        logins: [new Date()]
      });
    }
    
    await player.save();
    res.json(player);
  } catch (error) {
    console.error('Error adding IP address:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add punishment to player
router.post('/api/players/:uuid/punishments', async (req, res) => {
  try {
    const { 
      issuerName, 
      type, 
      notes, 
      attachedTicketIds, 
      data 
    } = req.body;
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Generate a random 8-character alphanumeric ID
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    player.punishments.push({
      id,
      issuerName,
      issued: new Date(),
      started: new Date(),
      type,
      modifications: [],
      notes: notes || [],
      attachedTicketIds: attachedTicketIds || [],
      data: data || {}
    });
    
    await player.save();
    res.json(player);
  } catch (error) {
    console.error('Error adding punishment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add modification to a punishment
router.post('/api/players/:uuid/punishments/:punishmentId/modifications', async (req, res) => {
  try {
    const { type, issuerName, effectiveDuration } = req.body;
    
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const punishment = player.punishments.find(p => p.id === req.params.punishmentId);
    if (!punishment) {
      return res.status(404).json({ error: 'Punishment not found' });
    }
    
    punishment.modifications.push({
      type,
      issuerName,
      issued: new Date(),
      effectiveDuration
    });
    
    await player.save();
    res.json(player);
  } catch (error) {
    console.error('Error adding modification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active punishments for a player
router.get('/api/players/:uuid/activePunishments', async (req, res) => {
  try {
    const player = await Player.findOne({ minecraftUuid: req.params.uuid });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Filter for active punishments (no end date or end date in the future)
    const activePunishments = player.punishments.filter(punishment => {
      // If there's no duration in data, it's permanent
      if (!punishment.data || !punishment.data.has('duration')) {
        return true;
      }
      
      const duration = punishment.data.get('duration');
      const startTime = punishment.started ? punishment.started.getTime() : punishment.issued.getTime();
      const endTime = startTime + Number(duration);
      
      return endTime > Date.now();
    });
    
    res.json(activePunishments);
  } catch (error) {
    console.error('Error fetching active punishments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;