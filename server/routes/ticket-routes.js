const express = require('express');
const router = express.Router();
const { Ticket } = require('../models/mongodb-schemas');

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

// Add note to ticket
router.post('/api/tickets/:id/notes', async (req, res) => {
  try {
    const { text, issuerName } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.notes.push({
      text,
      issuerName,
      date: new Date()
    });
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add reply to ticket
router.post('/api/tickets/:id/replies', async (req, res) => {
  try {
    const { name, content, type, staff } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.replies.push({
      name,
      content,
      type,
      created: new Date(),
      staff: staff || false
    });
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add tag to ticket
router.post('/api/tickets/:id/tags', async (req, res) => {
  try {
    const { tag } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (!ticket.tags.includes(tag)) {
      ticket.tags.push(tag);
      await ticket.save();
    }
    
    res.json(ticket);
  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove tag from ticket
router.delete('/api/tickets/:id/tags/:tag', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    ticket.tags = ticket.tags.filter(tag => tag !== req.params.tag);
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ticket data
router.patch('/api/tickets/:id/data', async (req, res) => {
  try {
    const { data } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Merge new data with existing data
    for (const [key, value] of Object.entries(data)) {
      ticket.data.set(key, value);
    }
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    console.error('Error updating ticket data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tickets by tag
router.get('/api/tickets/tag/:tag', async (req, res) => {
  try {
    const tickets = await Ticket.find({ tags: req.params.tag });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets by tag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get tickets by creator
router.get('/api/tickets/creator/:uuid', async (req, res) => {
  try {
    const tickets = await Ticket.find({ creator: req.params.uuid });
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets by creator:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;