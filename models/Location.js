const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  address: {
    type: String,
    required: true
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Location', locationSchema);
