const express = require('express');
const router = express.Router();
const moment = require('moment');
const mongoose = require('mongoose');
const Location = require('../models/Location');
const Ride = require('../models/Ride');
const Admin = require('../models/Admin');

// Database connection helper
const ensureDBConnection = async () => {
  if (mongoose.connections[0].readyState !== 1) {
    // Wait for connection if not ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Database connection timeout')), 10000);
      
      if (mongoose.connections[0].readyState === 1) {
        clearTimeout(timeout);
        resolve();
        return;
      }
      
      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      mongoose.connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }
};

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  } else {
    return res.redirect('/admin/login');
  }
};

// Login page
router.get('/login', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { 
    error: null, 
    username: null 
  });
});

// Login form submission
router.post('/login', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { username, password } = req.body;
    
    console.log('Login attempt for username:', username);
    
    // Find admin by username
    const admin = await Admin.findOne({ 
      username: username.toLowerCase().trim(),
      isActive: true 
    });
    
    if (!admin) {
      console.log('Admin not found for username:', username);
      return res.render('admin/login', { 
        error: 'Invalid username or password',
        username: username 
      });
    }
    
    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      console.log('Password mismatch for username:', username);
      return res.render('admin/login', { 
        error: 'Invalid username or password',
        username: username 
      });
    }
    
    // Update last login
    await admin.updateLastLogin();
    
    // Create session
    req.session.admin = {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role
    };
    
    console.log('Session created for admin:', admin.username);
    console.log('Redirecting to /admin');
    
    res.redirect('/admin');
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { 
      error: 'Login failed. Please try again.',
      username: req.body.username 
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/admin/login');
  });
});

// Admin dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const today = moment().startOf('day');
    const tomorrow = moment().add(1, 'day').startOf('day');

    // Get today's rides
    const todayRides = await Ride.find({
      departureTime: {
        $gte: today.toDate(),
        $lt: tomorrow.toDate()
      }
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });

    // Get all upcoming rides
    const upcomingRides = await Ride.find({
      departureTime: { $gte: new Date() },
      status: { $in: ['waiting', 'in_progress'] }
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });    res.render('admin/dashboard', {
      todayRides,
      upcomingRides,
      moment,
      admin: req.session.admin
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

// Manage locations
router.get('/locations', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const locations = await Location.find().sort({ name: 1 });
    res.render('admin/locations', { 
      locations, 
      admin: req.session.admin 
    });
  } catch (error) {
    console.error('Locations get error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

// Add location
router.post('/locations', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { name, address, lat, lng } = req.body;
    
    const location = new Location({
      name: name.trim(),
      address: address ? address.trim() : '',
      coordinates: {
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null
      }
    });

    await location.save();
    res.redirect('/admin/locations');
  } catch (error) {
    console.error('Add location error:', error);
    if (error.code === 11000) {
      res.status(400).send('Location name already exists');
    } else {
      res.status(500).send('Server Error: ' + error.message);
    }
  }
});

// Toggle location active status
router.post('/locations/:id/toggle', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const location = await Location.findById(req.params.id);
    if (!location) {
      return res.status(404).send('Location not found');
    }
    
    location.isActive = !location.isActive;
    await location.save();
    res.redirect('/admin/locations');
  } catch (error) {
    console.error('Toggle location error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

// Delete location
router.post('/locations/:id/delete', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    // Check if location is being used in any rides
    const ridesUsingLocation = await Ride.find({
      $or: [
        { origin: req.params.id },
        { destination: req.params.id }
      ]
    });

    if (ridesUsingLocation.length > 0) {
      return res.status(400).send('Cannot delete location as it is being used in existing rides. Please cancel or complete those rides first.');
    }

    const location = await Location.findByIdAndDelete(req.params.id);
    
    if (!location) {
      return res.status(404).send('Location not found');
    }

    res.redirect('/admin/locations');
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

module.exports = router;
