const express = require('express');
const router = express.Router();
const moment = require('moment');
const Location = require('../models/Location');
const Ride = require('../models/Ride');

// Home page - User interface
router.get('/', async (req, res) => {
  try {
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
    console.error(error);
    res.status(500).send('Server Error');
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
