const express = require('express');
const router = express.Router();
const moment = require('moment');
const Location = require('../models/Location');
const Ride = require('../models/Ride');

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

// Home page - User interface
router.get('/', async (req, res) => {
  try {
    // Auto-archive past rides before loading page
    await autoArchivePastRides();
    
    const locations = await Location.find({ isActive: true });
    const now = new Date();
    const availableRides = await Ride.find({
      departureTime: { $gte: now },
      status: 'waiting'
    })
    .populate('origin destination')
    .sort({ departureTime: 1 });

    // Filter out rides with null origin or destination (orphaned rides)
    const validRides = availableRides.filter(ride => 
      ride.origin && ride.destination && ride.origin.name && ride.destination.name
    );

    // Clean up orphaned rides in the background
    const orphanedRides = availableRides.filter(ride => 
      !ride.origin || !ride.destination || !ride.origin.name || !ride.destination.name
    );
    
    if (orphanedRides.length > 0) {
      console.log(`Found ${orphanedRides.length} orphaned rides, cleaning up...`);
      const orphanedIds = orphanedRides.map(ride => ride._id);
      await Ride.deleteMany({ _id: { $in: orphanedIds } });
    }

    res.render('index', {
      locations,
      rides: validRides,
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
