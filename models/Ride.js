const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  creator: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
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
  maxPassengers: {
    type: Number,
    default: 4,
    min: 1,
    max: 8
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
  },
  notes: String
}, {
  timestamps: true
});

// Virtual for available seats
rideSchema.virtual('availableSeats').get(function() {
  return this.maxPassengers - this.passengers.length;
});

// Method to check if ride is full
rideSchema.methods.isFull = function() {
  return this.passengers.length >= this.maxPassengers;
};

// Method to add passenger
rideSchema.methods.addPassenger = function(passenger) {
  if (!this.isFull()) {
    this.passengers.push(passenger);
    return true;
  }
  return false;
};

module.exports = mongoose.model('Ride', rideSchema);
