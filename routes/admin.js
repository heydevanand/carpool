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

// Auto-archive past rides function
const autoArchivePastRides = async () => {
  try {
    const now = new Date();
    
    // Find rides that are past their departure time and not yet archived
    const pastRides = await Ride.find({
      departureTime: { $lt: now },
      status: { $in: ['waiting', 'in_progress', 'completed', 'cancelled'] }
    });
    
    if (pastRides.length > 0) {
      // Auto-archive past rides
      await Ride.updateMany(
        {
          departureTime: { $lt: now },
          status: { $in: ['waiting', 'in_progress', 'completed', 'cancelled'] }
        },
        { 
          status: 'archived',
          updatedAt: new Date()
        }
      );
      
      console.log(`Auto-archived ${pastRides.length} past rides`);
    }
    
    return pastRides.length;
  } catch (error) {
    console.error('Auto-archive error:', error);
    return 0;
  }
};

// Admin dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    // Auto-archive past rides before loading dashboard
    await autoArchivePastRides();
    
    const today = moment().startOf('day');
    const tomorrow = moment().add(1, 'day').startOf('day');    // Get all upcoming rides (only future rides and current in-progress rides)
    const upcomingRidesRaw = await Ride.find({
      $or: [
        { departureTime: { $gte: new Date() } },
        { status: 'in_progress' }
      ],
      status: { $in: ['waiting', 'in_progress', 'completed'] }
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });

    // Get archived rides (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const archivedRidesRaw = await Ride.find({
      status: 'archived',
      updatedAt: { $gte: thirtyDaysAgo }
    })
    .populate('origin destination')
    .sort({ departureTime: -1 });

    // Filter out orphaned rides and clean them up
    const upcomingRides = upcomingRidesRaw.filter(ride => 
      ride.origin && ride.destination && ride.origin.name && ride.destination.name
    );

    const archivedRides = archivedRidesRaw.filter(ride => 
      ride.origin && ride.destination && ride.origin.name && ride.destination.name
    );

    // Clean up orphaned rides
    const allOrphanedRides = [...upcomingRidesRaw, ...archivedRidesRaw].filter(ride => 
      !ride.origin || !ride.destination || !ride.origin.name || !ride.destination.name
    );
      if (allOrphanedRides.length > 0) {
      const orphanedIds = allOrphanedRides.map(ride => ride._id);
      await Ride.deleteMany({ _id: { $in: orphanedIds } });
    }

    res.render('admin/dashboard', {
      upcomingRides,
      archivedRides,
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
    
    // First, cleanup any orphaned rides
    const allRides = await Ride.find({}).populate('origin destination');
    const orphanedRides = allRides.filter(ride => 
      !ride.origin || !ride.destination
    );
      if (orphanedRides.length > 0) {
      const orphanedIds = orphanedRides.map(ride => ride._id);
      await Ride.deleteMany({ _id: { $in: orphanedIds } });
    }
    
    // Check if location is being used in any active rides (excluding archived and cancelled)
    const activeRidesUsingLocation = await Ride.find({
      $or: [
        { origin: req.params.id },
        { destination: req.params.id }
      ],
      status: { $in: ['waiting', 'in_progress'] }
    });

    if (activeRidesUsingLocation.length > 0) {
      return res.status(400).send(`Cannot delete location as it is being used in ${activeRidesUsingLocation.length} active rides. Please cancel or complete those rides first.`);
    }

    // Clean up completed and archived rides using this location (they're historical, can be removed)
    const historicalRidesUsingLocation = await Ride.find({
      $or: [
        { origin: req.params.id },
        { destination: req.params.id }
      ],
      status: { $in: ['completed', 'archived', 'cancelled'] }
    });

    if (historicalRidesUsingLocation.length > 0) {      await Ride.deleteMany({
        $or: [
          { origin: req.params.id },
          { destination: req.params.id }
        ],
        status: { $in: ['completed', 'archived', 'cancelled'] }
      });
    }

    const location = await Location.findByIdAndDelete(req.params.id);
    
    if (!location) {
      return res.status(404).send('Location not found');
    }

    res.redirect('/admin/locations?message=Location deleted successfully along with historical rides');
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

// Cleanup old archived rides (older than 1 week)
const cleanupOldArchivedRides = async () => {
  try {
    await ensureDBConnection();
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const result = await Ride.deleteMany({
      status: 'archived',
      updatedAt: { $lt: oneWeekAgo }
    });
      console.log(`Cleaned up ${result.deletedCount} archived rides older than 1 week`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up archived rides:', error);
    return 0;
  }
};

// Manual cleanup endpoint (for testing)
router.post('/cleanup-archived', requireAuth, async (req, res) => {
  try {
    const deletedCount = await cleanupOldArchivedRides();
    res.json({ 
      success: true, 
      message: `Cleaned up ${deletedCount} archived rides older than 1 week` 
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clean up orphaned rides endpoint
router.post('/cleanup-orphaned', requireAuth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    let cleanupSummary = {
      orphanedRides: 0,
      oldArchivedRides: 0,
      totalCleaned: 0
    };
    
    // Find all rides and populate locations
    const allRides = await Ride.find({}).populate('origin destination');
    
    // Find orphaned rides (rides with missing locations)
    const orphanedRides = allRides.filter(ride => 
      !ride.origin || !ride.destination
    );
      if (orphanedRides.length > 0) {
      const orphanedIds = orphanedRides.map(ride => ride._id);
      await Ride.deleteMany({ _id: { $in: orphanedIds } });
      cleanupSummary.orphanedRides = orphanedRides.length;
    }
    
    // Clean up old archived rides (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldArchivedResult = await Ride.deleteMany({
      status: 'archived',
      updatedAt: { $lt: thirtyDaysAgo }
    });
      cleanupSummary.oldArchivedRides = oldArchivedResult.deletedCount;
    cleanupSummary.totalCleaned = cleanupSummary.orphanedRides + cleanupSummary.oldArchivedRides;
    
    res.json({ 
      success: true, 
      message: `Database cleanup completed! Removed ${cleanupSummary.orphanedRides} orphaned rides and ${cleanupSummary.oldArchivedRides} old archived rides. Total: ${cleanupSummary.totalCleaned} rides cleaned.`,
      summary: cleanupSummary
    });
  } catch (error) {
    console.error('Orphaned cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export cleanup functions for use in server
router.cleanupOldArchivedRides = cleanupOldArchivedRides;
router.autoArchivePastRides = autoArchivePastRides;

module.exports = router;
