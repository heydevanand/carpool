const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const Location = require('../models/Location');
const mongoose = require('mongoose');

// Auto-archive past rides function
async function autoArchivePastRides() {
  try {
    const now = new Date();
    
    // Find rides that are past their departure time and not yet archived
    const result = await Ride.updateMany(
      {
        departureTime: { $lt: now },
        status: { $in: ['waiting', 'in_progress', 'completed', 'cancelled'] }
      },
      { 
        status: 'archived',
        updatedAt: new Date()
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Auto-archived ${result.modifiedCount} past rides`);
    }
    
    return result.modifiedCount;
  } catch (error) {
    console.error('Auto-archive error:', error);
    return 0;
  }
}

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
    
    // Auto-archive past rides before fetching
    await autoArchivePastRides();
    
    const now = new Date();
    const rides = await Ride.find({
      departureTime: { $gte: now },
      status: 'waiting'
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });

    // Filter out rides with null origin or destination (orphaned rides)
    const validRides = rides.filter(ride => 
      ride.origin && ride.destination && ride.origin.name && ride.destination.name
    );

    // Clean up orphaned rides in the background
    const orphanedRides = rides.filter(ride => 
      !ride.origin || !ride.destination || !ride.origin.name || !ride.destination.name
    );
    
    if (orphanedRides.length > 0) {
      console.log(`Found ${orphanedRides.length} orphaned rides, cleaning up...`);
      const orphanedIds = orphanedRides.map(ride => ride._id);
      await Ride.deleteMany({ _id: { $in: orphanedIds } });
    }

    res.json(validRides);
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new ride or join an existing one
router.post('/rides', async (req, res) => {
  try {
    await ensureDBConnection();
    
    // Auto-archive past rides before creating new ones
    await autoArchivePastRides();
    
    const { passengerName, passengerPhone, origin, destination, departureTime } = req.body;

    // Parse the datetime-local input as local time
    const departureDate = new Date(departureTime);
    
    // Look for existing rides with same route and similar time (within 30 minutes)
    const timeWindow = 30 * 60 * 1000; // 30 minutes in milliseconds
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

    res.json({ success: true, ride, message: 'New ride request created!' });
  } catch (error) {
    console.error('Error creating/joining ride:', error);
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
