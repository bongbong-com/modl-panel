const express = require('express');
const router = express.Router();
const { Log } = require('../models/mongodb-schemas');

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

// Get logs with pagination and filtering
router.get('/api/logs/search', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    // Build query
    let query = {};
    
    if (search) {
      query.description = { $regex: search, $options: 'i' };
    }
    
    // Count total documents
    const total = await Log.countDocuments(query);
    
    // Find logs with pagination
    const logs = await Log.find(query)
      .sort({ created: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      logs,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error searching logs:', error);
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

// Get logs by date range
router.get('/api/logs/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const query = {
      created: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
    
    const logs = await Log.find(query).sort({ created: -1 });
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs by date range:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to create system logs (used internally)
async function createSystemLog(description) {
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

module.exports = {
  router,
  createSystemLog
};