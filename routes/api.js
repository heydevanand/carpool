const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const Location = require('../models/Location');

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

// Get all available rides
router.get('/rides', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const now = new Date();
    const rides = await Ride.find({
      departureTime: { $gte: now },
      status: 'waiting'
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });

    res.json(rides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new ride
router.post('/rides', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { creatorName, creatorPhone, origin, destination, departureTime, maxPassengers, notes } = req.body;

    const ride = new Ride({
      creator: {
        name: creatorName,
        phone: creatorPhone
      },
      origin,
      destination,
      departureTime: new Date(departureTime),
      maxPassengers: parseInt(maxPassengers) || 4,
      notes
    });

    await ride.save();
    await ride.populate('origin destination');

    res.json({ success: true, ride });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a ride
router.post('/rides/:id/join', async (req, res) => {
  try {
    const { passengerName, passengerPhone } = req.body;
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (ride.isFull()) {
      return res.status(400).json({ error: 'Ride is full' });
    }

    // Check if passenger already joined
    const alreadyJoined = ride.passengers.some(p => p.phone === passengerPhone);
    if (alreadyJoined) {
      return res.status(400).json({ error: 'You have already joined this ride' });
    }

    const success = ride.addPassenger({
      name: passengerName,
      phone: passengerPhone
    });

    if (success) {
      await ride.save();
      await ride.populate('origin destination');
      res.json({ success: true, ride });
    } else {
      res.status(400).json({ error: 'Unable to join ride' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update ride status
router.put('/rides/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('origin destination');

    res.json({ success: true, ride });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
