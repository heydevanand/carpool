const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Create a test app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock environment variables
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

// Mock the logger to avoid file operations in tests
jest.mock('../../middleware/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock models with proper implementations
jest.mock('../../models/Ride', () => {
  const mockRide = {
    _id: 'mockRideId',
    origin: 'mockOriginId',
    destination: 'mockDestinationId',
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    passengers: [],
    status: 'waiting',
    addPassenger: jest.fn().mockReturnValue(true),
    save: jest.fn().mockResolvedValue(true),
    populate: jest.fn().mockReturnThis()
  };

  return {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      })
    }),
    findOne: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(mockRide),
    findByIdAndUpdate: jest.fn().mockResolvedValue(mockRide),
    findByIdAndDelete: jest.fn().mockResolvedValue(mockRide),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    prototype: {
      save: jest.fn().mockResolvedValue(mockRide),
      populate: jest.fn().mockResolvedValue(mockRide)
    }
  };
});

jest.mock('../../models/Location', () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null)
}));

// Mock mongoose connection
mongoose.connection = {
  readyState: 1,
  close: jest.fn()
};
mongoose.connect = jest.fn().mockResolvedValue(true);

// Import and setup routes after mocking
const apiRoutes = require('../../routes/api');
app.use('/api', apiRoutes);

// Add basic error handling
app.use((error, req, res, next) => {
  res.status(error.status || 500).json({
    error: error.message || 'Internal Server Error'
  });
});

describe('API Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/rides', () => {
    it('should return rides list', async () => {
      const response = await request(app)
        .get('/api/rides')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const Ride = require('../../models/Ride');
      Ride.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              limit: jest.fn().mockRejectedValue(new Error('Database connection failed'))
            })
          })
        })
      });

      const response = await request(app)
        .get('/api/rides')
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/rides', () => {
    const validRideData = {
      origin: '507f1f77bcf86cd799439011',
      destination: '507f1f77bcf86cd799439012',
      departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      passengerName: 'Test Passenger',
      passengerPhone: '1234567890'
    };

    it('should create a new ride with valid data', async () => {
      const Ride = require('../../models/Ride');
      
      // Mock constructor
      Ride.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({
          _id: 'mockRideId',
          origin: { name: 'Test Origin' },
          destination: { name: 'Test Destination' },
          ...validRideData
        })
      }));

      const response = await request(app)
        .post('/api/rides')
        .send(validRideData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('ride');
    });

    it('should reject invalid ride data (missing origin)', async () => {
      const invalidData = { ...validRideData };
      delete invalidData.origin;

      const response = await request(app)
        .post('/api/rides')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid ride data (missing passenger name)', async () => {
      const invalidData = { ...validRideData };
      delete invalidData.passengerName;

      const response = await request(app)
        .post('/api/rides')
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject past departure times', async () => {
      const pastTimeData = {
        ...validRideData,
        departureTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Yesterday
      };

      const response = await request(app)
        .post('/api/rides')
        .send(pastTimeData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid ObjectId format', async () => {
      const invalidIdData = {
        ...validRideData,
        origin: 'invalid-id'
      };

      const response = await request(app)
        .post('/api/rides')
        .send(invalidIdData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/rides/:id/join', () => {
    it('should allow joining an existing ride', async () => {
      const response = await request(app)
        .post('/api/rides/507f1f77bcf86cd799439011/join')
        .send({
          passengerName: 'New Passenger',
          passengerPhone: '9876543210'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('ride');
    });

    it('should return 404 for non-existent ride', async () => {
      const Ride = require('../../models/Ride');
      Ride.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/rides/507f1f77bcf86cd799439011/join')
        .send({
          passengerName: 'New Passenger',
          passengerPhone: '9876543210'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Ride not found');
    });
  });

  describe('PUT /api/rides/:id/status', () => {
    it('should update ride status', async () => {
      const response = await request(app)
        .put('/api/rides/507f1f77bcf86cd799439011/status')
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('ride');
    });

    it('should return 404 for non-existent ride', async () => {
      const Ride = require('../../models/Ride');
      Ride.findByIdAndUpdate.mockResolvedValueOnce(null);

      const response = await request(app)
        .put('/api/rides/507f1f77bcf86cd799439011/status')
        .send({ status: 'completed' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Ride not found');
    });
  });

  describe('DELETE /api/rides/:id', () => {
    it('should delete a ride', async () => {
      const response = await request(app)
        .delete('/api/rides/507f1f77bcf86cd799439011')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Ride deleted successfully');
    });

    it('should return 404 for non-existent ride', async () => {
      const Ride = require('../../models/Ride');
      Ride.findByIdAndDelete.mockResolvedValueOnce(null);

      const response = await request(app)
        .delete('/api/rides/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Ride not found');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to ride creation', async () => {
      const validData = {
        origin: '507f1f77bcf86cd799439011',
        destination: '507f1f77bcf86cd799439012',
        departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        passengerName: 'Test',
        passengerPhone: '1234567890'
      };

      // Make 6 rapid requests (limit is 5)
      const promises = Array(6).fill().map((_, index) => 
        request(app)
          .post('/api/rides')
          .send({ ...validData, passengerPhone: `123456789${index}` })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});
