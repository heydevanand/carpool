const express = require('express');
const router = express.Router();
const moment = require('moment');
const Location = require('../models/Location');
const Ride = require('../models/Ride');

// Admin dashboard
router.get('/', async (req, res) => {
  try {
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
