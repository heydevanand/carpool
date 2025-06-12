const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const Location = require('../models/Location');
const mongoose = require('mongoose');

// Get all available rides
router.get('/rides', async (req, res) => {
  try {
    const now = new Date();
    const rides = await Ride.find({
      departureTime: { $gte: now },
      status: 'waiting'
    })
    .populate('origin destination')
    .sort({ departureTime: 1 })
    .limit(50);

    res.json(rides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: 'Failed to fetch rides' });
  }
});

// Create a new ride or join an existing one
router.post('/rides', async (req, res) => {
  try {
    const { passengerName, passengerPhone, origin, destination, departureTime } = req.body;
    
    // Basic validation
    if (!passengerName || !passengerPhone || !origin || !destination || !departureTime) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const departureDate = new Date(departureTime);
    
    // Validate business hours (8 AM to 8 PM only)
    const departureHour = departureDate.getHours();
    if (departureHour < 8 || departureHour > 20) {
      return res.status(400).json({ 
        error: 'Rides are only available between 8:00 AM and 8:00 PM' 
      });
    }
    
    // Look for existing rides with same route and similar time (within 30 minutes)
    const timeWindow = 30 * 60 * 1000; // 30 minutes
    const startTime = new Date(departureDate.getTime() - timeWindow);
    const endTime = new Date(departureDate.getTime() + timeWindow);
    
    let existingRide = await Ride.findOne({
      origin,
      destination,
      departureTime: { $gte: startTime, $lte: endTime },
      status: 'waiting'
    }).populate('origin destination');

    if (existingRide) {
      // Add passenger to existing ride
      const success = existingRide.addPassenger({
        name: passengerName,
        phone: passengerPhone
      });

      if (success) {
        await existingRide.save();
        return res.json({ 
          success: true, 
          ride: existingRide, 
          message: 'Joined existing ride for the same route and time!' 
        });
      } else {
        return res.status(400).json({ error: 'You have already joined this ride' });
      }
    }

    // Create new ride if no existing ride found
    const ride = new Ride({
      origin,
      destination,
      departureTime: departureDate,
      passengers: [{
        name: passengerName,
        phone: passengerPhone,
        joinedAt: new Date()
      }]
    });

    await ride.save();
    await ride.populate('origin destination');

    res.status(201).json({ success: true, ride, message: 'New ride request created!' });
  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({ error: 'Failed to create ride' });
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
    res.status(500).json({ error: 'Failed to join ride' });
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

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json({ success: true, ride });
  } catch (error) {
    console.error('Error updating ride:', error);
    res.status(500).json({ error: 'Failed to update ride' });
  }
});

// Delete a ride
router.delete('/rides/:id', async (req, res) => {
  try {
    const ride = await Ride.findByIdAndDelete(req.params.id);
    
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json({ success: true, message: 'Ride deleted successfully' });
  } catch (error) {
    console.error('Error deleting ride:', error);
    res.status(500).json({ error: 'Failed to delete ride' });
  }
});

module.exports = router;
