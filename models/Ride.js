const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  origin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  destination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  departureTime: {
    type: Date,
    required: true
  },
  passengers: [{
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],  status: {
    type: String,
    enum: ['waiting', 'in_progress', 'completed', 'cancelled', 'archived'],
    default: 'waiting'
  }
}, {
  timestamps: true
});

// Method to add passenger
rideSchema.methods.addPassenger = function(passenger) {
  // Check if passenger already exists
  const existingPassenger = this.passengers.find(p => p.phone === passenger.phone);
  if (!existingPassenger) {
    this.passengers.push(passenger);
    return true;
  }
  return false;
};

module.exports = mongoose.model('Ride', rideSchema);
