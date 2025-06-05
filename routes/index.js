const express = require('express');
const router = express.Router();
const moment = require('moment');
const mongoose = require('mongoose');
const Location = require('../models/Location');
const Ride = require('../models/Ride');

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

// Home page - User interface
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const locations = await Location.find({ isActive: true });
    const now = new Date();
    const availableRides = await Ride.find({
      departureTime: { $gte: now },
      status: 'waiting'
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });

    res.render('index', {
      locations,
      rides: availableRides,
      moment
    });
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

// Create ride page
router.get('/create-ride', async (req, res) => {
  try {
    const locations = await Location.find({ isActive: true });
    res.render('create-ride', { locations });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
