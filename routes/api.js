const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const Location = require('../models/Location');
const mongoose = require('mongoose');

// Ensure database connection
async function ensureDBConnection() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

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
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new ride
router.post('/rides', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { creatorName, creatorPhone, origin, destination, departureTime, maxPassengers, notes } = req.body;

    // Parse the datetime-local input as local time
    const departureDate = new Date(departureTime);
    
    const ride = new Ride({
      creator: {
        name: creatorName,
        phone: creatorPhone
      },
      origin,
      destination,
      departureTime: departureDate,
      maxPassengers: parseInt(maxPassengers) || 4,
      notes
    });

    await ride.save();
    await ride.populate('origin destination');

    res.json({ success: true, ride });
  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({ error: error.message });
  }
});

// Join a ride
router.post('/rides/:id/join', async (req, res) => {
  try {
    await ensureDBConnection();
    
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
    console.error('Error joining ride:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update ride status
router.put('/rides/:id/status', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { status } = req.body;
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('origin destination');

    res.json({ success: true, ride });
  } catch (error) {
    console.error('Error updating ride status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a ride
router.delete('/rides/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const ride = await Ride.findByIdAndDelete(req.params.id);
    
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json({ success: true, message: 'Ride deleted successfully' });
  } catch (error) {
    console.error('Error deleting ride:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
