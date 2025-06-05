const mongoose = require('mongoose');
const Location = require('./models/Location');

const MONGODB_URI = 'mongodb+srv://heydevanand:engineerdev@dev-cluster.okxr9gy.mongodb.net/pg-carpool?retryWrites=true&w=majority&appName=Dev-Cluster';

const sampleLocations = [
  {
    name: 'PG Main Gate',
    address: 'Main entrance of the PG building',
    coordinates: { lat: 12.9716, lng: 77.5946 },
    isActive: true
  },
  {
    name: 'Tech Park Gate 1',
    address: 'Manyata Tech Park, Main Gate 1, Bangalore',
    coordinates: { lat: 13.0475, lng: 77.6212 },
    isActive: true
  },
  {
    name: 'Electronic City Metro',
    address: 'Electronic City Metro Station, Bangalore',
    coordinates: { lat: 12.8456, lng: 77.6603 },
    isActive: true
  },
  {
    name: 'Koramangala BDA Complex',
    address: 'BDA Complex, Koramangala, Bangalore',
    coordinates: { lat: 12.9279, lng: 77.6271 },
    isActive: true
  },
  {
    name: 'Whitefield Railway Station',
    address: 'Whitefield Railway Station, Bangalore',
    coordinates: { lat: 12.9698, lng: 77.7499 },
    isActive: true
  },
  {
    name: 'HSR Layout',
    address: 'HSR Layout Sector 1, Bangalore',
    coordinates: { lat: 12.9082, lng: 77.6476 },
    isActive: true
  },
  {
    name: 'Indiranagar Metro',
    address: 'Indiranagar Metro Station, Bangalore',
    coordinates: { lat: 12.9719, lng: 77.6412 },
    isActive: true
  },
  {
    name: 'Brigade Road',
    address: 'Brigade Road, Bangalore',
    coordinates: { lat: 12.9716, lng: 77.6197 },
    isActive: true
  }
];

async function seedLocations() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Clear existing locations
    await Location.deleteMany({});
    console.log('Cleared existing locations');

    // Insert sample locations
    await Location.insertMany(sampleLocations);
    console.log('Sample locations added successfully');

    console.log('\nAdded locations:');
    sampleLocations.forEach((location, index) => {
      console.log(`${index + 1}. ${location.name} - ${location.address}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding locations:', error);
    process.exit(1);
  }
}

seedLocations();
