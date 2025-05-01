const express = require('express');
const router = express.Router();
const { Player, Ticket } = require('../models/mongodb-schemas');

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

// Get appeal by ID
router.get('/api/appeals/:id', async (req, res) => {
  try {
    const appeal = await Ticket.findById(req.params.id);
    
    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    // Check if this is an appeal ticket
    if (!appeal.data || !appeal.data.get('punishmentId')) {
      return res.status(400).json({ error: 'Ticket is not an appeal' });
    }
    
    res.json(appeal);
  } catch (error) {
    console.error('Error fetching appeal:', error);
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
    
    // Add initial messages
    appeal.replies = [
      {
        name: player.usernames[player.usernames.length - 1]?.username || 'Player',
        content: formattedContent,
        type: 'player',
        created: new Date(),
        staff: false
      },
      {
        name: 'System',
        content: 'Your appeal has been received and will be reviewed by our moderation team.',
        type: 'system',
        created: new Date(),
        staff: false
      }
    ];
    
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

// Add reply to appeal
router.post('/api/appeals/:id/replies', async (req, res) => {
  try {
    const { name, content, type, staff } = req.body;
    
    const appeal = await Ticket.findById(req.params.id);
    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    // Make sure this is an appeal ticket
    if (!appeal.data || !appeal.data.get('punishmentId')) {
      return res.status(400).json({ error: 'Ticket is not an appeal' });
    }
    
    appeal.replies.push({
      name,
      content,
      type,
      created: new Date(),
      staff: staff || false
    });
    
    // Update last activity timestamp
    appeal.data.set('lastActivity', new Date());
    
    await appeal.save();
    res.json(appeal);
  } catch (error) {
    console.error('Error adding reply to appeal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update appeal status
router.patch('/api/appeals/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['Pending Review', 'Under Review', 'Rejected', 'Approved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    const appeal = await Ticket.findById(req.params.id);
    if (!appeal) {
      return res.status(404).json({ error: 'Appeal not found' });
    }
    
    // Make sure this is an appeal ticket
    if (!appeal.data || !appeal.data.get('punishmentId')) {
      return res.status(400).json({ error: 'Ticket is not an appeal' });
    }
    
    // Update the status
    appeal.data.set('status', status);
    appeal.data.set('lastStatusUpdate', new Date());
    
    // If approved, handle the punishment modification
    if (status === 'Approved') {
      const punishmentId = appeal.data.get('punishmentId');
      const player = await Player.findOne({ 'punishments.id': punishmentId });
      
      if (player) {
        const punishment = player.punishments.find(p => p.id === punishmentId);
        
        if (punishment) {
          // Add a modification to the punishment
          punishment.modifications.push({
            type: 'Appeal Approved',
            issuerName: 'System',
            issued: new Date(),
            effectiveDuration: 0 // Effectively removing the punishment
          });
          
          await player.save();
        }
      }
    }
    
    await appeal.save();
    res.json(appeal);
  } catch (error) {
    console.error('Error updating appeal status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;