const express = require('express');
const router = express.Router();
const { Staff } = require('../models/mongodb-schemas');
const crypto = require('crypto');

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

// Get staff by username
router.get('/api/staff/:username', async (req, res) => {
  try {
    // Exclude sensitive fields
    const staff = await Staff.findOne({ username: req.params.username })
      .select('-twoFaSecret -passkey.publicKey -passkey.credentialId -passkey.signCount');
    
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff member:', error);
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
    
    // Generate a random 2FA secret (base32 encoded)
    const twoFaSecret = crypto.randomBytes(10).toString('base32');
    
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

// Update staff member
router.patch('/api/staff/:username', async (req, res) => {
  try {
    const { email, profilePicture, admin } = req.body;
    
    const staff = await Staff.findOne({ username: req.params.username });
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    // Update fields if provided
    if (email) staff.email = email;
    if (profilePicture) staff.profilePicture = profilePicture;
    if (admin !== undefined) staff.admin = admin;
    
    await staff.save();
    
    // Return everything except sensitive fields
    const safeStaff = staff.toObject();
    delete safeStaff.twoFaSecret;
    delete safeStaff.passkey;
    
    res.json(safeStaff);
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add passkey to staff member
router.post('/api/staff/:username/passkey', async (req, res) => {
  try {
    const { credentialId, publicKey, aaguid } = req.body;
    
    const staff = await Staff.findOne({ username: req.params.username });
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    staff.passkey = {
      credentialId,
      publicKey,
      signCount: 0,
      aaguid,
      createdAt: new Date()
    };
    
    await staff.save();
    
    // Return everything except sensitive fields
    const safeStaff = staff.toObject();
    delete safeStaff.twoFaSecret;
    delete safeStaff.passkey.publicKey;
    delete safeStaff.passkey.credentialId;
    
    res.json(safeStaff);
  } catch (error) {
    console.error('Error adding passkey:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if email exists (for registration)
router.get('/api/staff/check-email/:email', async (req, res) => {
  try {
    const staff = await Staff.findOne({ email: req.params.email });
    res.json({ exists: !!staff });
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if username exists (for registration)
router.get('/api/staff/check-username/:username', async (req, res) => {
  try {
    const staff = await Staff.findOne({ username: req.params.username });
    res.json({ exists: !!staff });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;