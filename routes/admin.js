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

// Admin dashboard
router.get('/', async (req, res) => {
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
    .sort({ departureTime: 1 });

    res.render('admin/dashboard', {
      todayRides,
      upcomingRides,
      moment
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Manage locations
router.get('/locations', async (req, res) => {
  try {
    const locations = await Location.find().sort({ name: 1 });
    res.render('admin/locations', { locations });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Add location
router.post('/locations', async (req, res) => {
  try {
    const { name, address, lat, lng } = req.body;
    
    const location = new Location({
      name,
      address,
      coordinates: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    });

    await location.save();
    res.redirect('/admin/locations');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Toggle location active status
router.post('/locations/:id/toggle', async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    location.isActive = !location.isActive;
    await location.save();
    res.redirect('/admin/locations');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
