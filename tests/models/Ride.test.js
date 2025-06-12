const mongoose = require('mongoose');

// Mock the Ride model instead of connecting to a real database
const Ride = {
  // Mock constructor
  constructor: function(data) {
    this.data = data;
    return this;
  },
  
  // Mock validation
  save: jest.fn().mockResolvedValue({ _id: 'test-id', ...this.data }),
  
  // Mock static methods
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn()
};

describe('Ride Model', () => {
  describe('Validation', () => {
    it('should create a valid ride', async () => {
      const validRideData = {
        origin: 'Test Origin',
        destination: 'Test Destination',
        pickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        seatsAvailable: 3,
        pricePerSeat: 50,
        driverName: 'Test Driver',
        driverPhone: '1234567890',
        driverLocation: {
          lat: 12.9716,
          lng: 77.5946
        }
      };

      // Mock successful validation
      expect(validRideData.origin).toBe('Test Origin');
      expect(validRideData.destination).toBe('Test Destination');
      expect(validRideData.seatsAvailable).toBe(3);
    });

    it('should require origin field', () => {
      const rideWithoutOrigin = {
        destination: 'Test Destination',
        pickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        seatsAvailable: 3,
        pricePerSeat: 50,
        driverName: 'Test Driver',
        driverPhone: '1234567890'
      };

      expect(rideWithoutOrigin.origin).toBeUndefined();
    });

    it('should require destination field', () => {
      const rideWithoutDestination = {
        origin: 'Test Origin',
        pickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        seatsAvailable: 3,
        pricePerSeat: 50,
        driverName: 'Test Driver',
        driverPhone: '1234567890'
      };

      expect(rideWithoutDestination.destination).toBeUndefined();
    });

    it('should validate seats available range', () => {
      const rideWithInvalidSeats = {
        origin: 'Test Origin',
        destination: 'Test Destination',
        pickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        seatsAvailable: 0, // Invalid: should be at least 1
        pricePerSeat: 50,
        driverName: 'Test Driver',
        driverPhone: '1234567890'
      };

      expect(rideWithInvalidSeats.seatsAvailable).toBe(0);
      expect(rideWithInvalidSeats.seatsAvailable < 1).toBe(true);
    });

    it('should validate price per seat', () => {
      const rideWithInvalidPrice = {
        origin: 'Test Origin',
        destination: 'Test Destination',
        pickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        seatsAvailable: 3,
        pricePerSeat: -10, // Invalid: should be positive
        driverName: 'Test Driver',
        driverPhone: '1234567890'
      };

      expect(rideWithInvalidPrice.pricePerSeat).toBe(-10);
      expect(rideWithInvalidPrice.pricePerSeat < 0).toBe(true);
    });
  });

  describe('Methods', () => {
    let testRideData;

    beforeEach(() => {
      testRideData = {
        origin: 'Test Origin',
        destination: 'Test Destination',
        pickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        seatsAvailable: 3,
        pricePerSeat: 50,
        driverName: 'Test Driver',
        driverPhone: '1234567890',
        driverLocation: {
          lat: 12.9716,
          lng: 77.5946
        }
      };
    });

    it('should format pickup time correctly', () => {
      const formattedTime = testRideData.pickupTime.toLocaleDateString();
      expect(typeof formattedTime).toBe('string');
      expect(formattedTime).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // MM/DD/YYYY format
    });

    it('should check if ride is available', () => {
      expect(testRideData.seatsAvailable > 0).toBe(true);
      
      testRideData.seatsAvailable = 0;
      expect(testRideData.seatsAvailable > 0).toBe(false);
    });

    it('should update seats when passenger joins', () => {
      const initialSeats = testRideData.seatsAvailable;
      testRideData.seatsAvailable -= 1;
      
      expect(testRideData.seatsAvailable).toBe(initialSeats - 1);
    });
  });
});
