# Carpool API Documentation

## Overview

The JS Palace Carpool API provides endpoints for managing carpool rides, locations, and administrative functions. This RESTful API is built with Express.js and includes comprehensive validation, error handling, and monitoring.

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://your-domain.com`

## Authentication

### Admin Authentication
Admin endpoints require session-based authentication. Login through the admin interface to access protected routes.

## API Endpoints

### Health & Monitoring

#### GET /health
Check application health status and system metrics.

**Response:**
```json
{
  "status": "healthy|warning|critical",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "environment": "development",
  "database": {
    "status": "connected",
    "ping": 5
  },
  "system": {
    "memory": {
      "usage": "45.2%",
      "free": "2.1GB",
      "total": "8GB"
    },
    "cpu": {
      "usage": "15.3%",
      "cores": 8
    },
    "loadAverage": [0.5, 0.7, 0.8]
  }
}
```

#### GET /metrics
Get detailed performance metrics (requires admin authentication).

**Response:**
```json
{
  "requests": {
    "total": 1250,
    "successful": 1200,
    "failed": 50,
    "byEndpoint": {
      "/api/rides": 800,
      "/api/locations": 200
    },
    "byMethod": {
      "GET": 900,
      "POST": 250,
      "PUT": 75,
      "DELETE": 25
    },
    "byStatusCode": {
      "200": 900,
      "201": 250,
      "400": 30,
      "404": 15,
      "500": 5
    }
  },
  "response_times": {
    "avg": 45.2,
    "min": 5,
    "max": 450,
    "p95": 120,
    "p99": 200
  },
  "system": {
    "memory": {...},
    "cpu": {...},
    "uptime": {...}
  },
  "database": {
    "queries": 2500,
    "errors": 5,
    "avg_response_time": 12.5
  },
  "errors": {
    "total": 50,
    "by_type": {
      "ValidationError": 30,
      "NotFoundError": 15,
      "DatabaseError": 5
    },
    "recent": [...]
  }
}
```

### Rides Management

#### GET /api/rides
Retrieve all rides with optional filtering.

**Query Parameters:**
- `status` - Filter by ride status (`upcoming`, `completed`, `cancelled`)
- `date` - Filter by specific date (YYYY-MM-DD)
- `location` - Filter by pickup or drop-off location
- `limit` - Limit number of results (default: 50, max: 100)
- `skip` - Number of records to skip for pagination

**Example Request:**
```
GET /api/rides?status=upcoming&limit=20&skip=0
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345",
      "pickupLocation": "JS Palace PG",
      "dropoffLocation": "Cyber City Metro",
      "date": "2024-01-15",
      "time": "09:00",
      "availableSeats": 3,
      "totalSeats": 4,
      "fare": 50,
      "driverName": "John Doe",
      "driverContact": "9876543210",
      "passengers": [
        {
          "name": "Jane Smith",
          "contact": "9876543211",
          "seatsBooked": 1
        }
      ],
      "status": "upcoming",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "skip": 0,
    "hasMore": true
  }
}
```

#### POST /api/rides
Create a new ride.

**Request Body:**
```json
{
  "pickupLocation": "JS Palace PG",
  "dropoffLocation": "Cyber City Metro",
  "date": "2024-01-15",
  "time": "09:00",
  "totalSeats": 4,
  "fare": 50,
  "driverName": "John Doe",
  "driverContact": "9876543210"
}
```

**Validation Rules:**
- `pickupLocation`: Required string, 2-100 characters
- `dropoffLocation`: Required string, 2-100 characters
- `date`: Required, must be today or future date (YYYY-MM-DD)
- `time`: Required, 24-hour format (HH:MM)
- `totalSeats`: Required integer, 1-8
- `fare`: Required number, 0-1000
- `driverName`: Required string, 2-50 characters
- `driverContact`: Required, valid 10-digit phone number

**Response:**
```json
{
  "success": true,
  "message": "Ride created successfully",
  "data": {
    "_id": "64a1b2c3d4e5f6789012345",
    "pickupLocation": "JS Palace PG",
    "dropoffLocation": "Cyber City Metro",
    "date": "2024-01-15",
    "time": "09:00",
    "availableSeats": 4,
    "totalSeats": 4,
    "fare": 50,
    "driverName": "John Doe",
    "driverContact": "9876543210",
    "passengers": [],
    "status": "upcoming",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z"
  }
}
```

#### GET /api/rides/:id
Retrieve a specific ride by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "64a1b2c3d4e5f6789012345",
    "pickupLocation": "JS Palace PG",
    "dropoffLocation": "Cyber City Metro",
    // ... full ride object
  }
}
```

#### PUT /api/rides/:id
Update an existing ride.

**Request Body:** (All fields optional)
```json
{
  "pickupLocation": "Updated Location",
  "dropoffLocation": "Updated Destination",
  "date": "2024-01-16",
  "time": "10:00",
  "totalSeats": 3,
  "fare": 60,
  "driverName": "Updated Driver",
  "driverContact": "9876543212"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ride updated successfully",
  "data": {
    "_id": "64a1b2c3d4e5f6789012345",
    // ... updated ride object
  }
}
```

#### DELETE /api/rides/:id
Delete a ride.

**Response:**
```json
{
  "success": true,
  "message": "Ride deleted successfully"
}
```

#### POST /api/rides/:id/book
Book seats in a ride.

**Request Body:**
```json
{
  "passengerName": "Jane Smith",
  "passengerContact": "9876543211",
  "seatsRequested": 2
}
```

**Validation Rules:**
- `passengerName`: Required string, 2-50 characters
- `passengerContact`: Required, valid 10-digit phone number
- `seatsRequested`: Required integer, 1-available seats

**Response:**
```json
{
  "success": true,
  "message": "Seats booked successfully",
  "data": {
    "bookingId": "64a1b2c3d4e5f6789012346",
    "rideId": "64a1b2c3d4e5f6789012345",
    "passengerName": "Jane Smith",
    "passengerContact": "9876543211",
    "seatsBooked": 2,
    "totalFare": 100,
    "bookingTime": "2024-01-01T11:00:00Z"
  }
}
```

#### DELETE /api/rides/:id/cancel/:passengerId
Cancel a booking.

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

### Locations Management

#### GET /api/locations
Retrieve all available locations.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012347",
      "name": "Cyber City Metro",
      "type": "metro",
      "address": "Cyber City, Gurgaon",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00Z"
    },
    {
      "_id": "64a1b2c3d4e5f6789012348",
      "name": "DLF Mall",
      "type": "mall",
      "address": "DLF Phase 1, Gurgaon",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### POST /api/locations
Create a new location (admin only).

**Request Body:**
```json
{
  "name": "New Location",
  "type": "office",
  "address": "Full address here"
}
```

**Validation Rules:**
- `name`: Required string, 2-100 characters, unique
- `type`: Required, one of: metro, mall, office, airport, other
- `address`: Required string, 5-200 characters

### Search

#### GET /api/search
Search rides with multiple criteria.

**Query Parameters:**
- `from` - Pickup location (partial match)
- `to` - Drop-off location (partial match)
- `date` - Travel date (YYYY-MM-DD)
- `minSeats` - Minimum available seats
- `maxFare` - Maximum fare amount

**Example:**
```
GET /api/search?from=palace&to=metro&date=2024-01-15&minSeats=2
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789012345",
      "pickupLocation": "JS Palace PG",
      "dropoffLocation": "Cyber City Metro",
      "date": "2024-01-15",
      "time": "09:00",
      "availableSeats": 3,
      "fare": 50,
      "driverName": "John Doe",
      "matchScore": 0.95
    }
  ],
  "meta": {
    "total": 1,
    "searchCriteria": {
      "from": "palace",
      "to": "metro",
      "date": "2024-01-15",
      "minSeats": 2
    }
  }
}
```

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Detailed error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "specific field error"
    }
  },
  "timestamp": "2024-01-01T10:00:00Z",
  "requestId": "req_64a1b2c3d4e5f6789012345"
}
```

### HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource conflict (e.g., duplicate booking)
- **422 Unprocessable Entity** - Validation errors
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error

### Common Error Codes

- `VALIDATION_ERROR` - Request validation failed
- `RIDE_NOT_FOUND` - Ride does not exist
- `SEATS_UNAVAILABLE` - Requested seats not available
- `BOOKING_EXPIRED` - Booking window has closed
- `DUPLICATE_BOOKING` - User already booked this ride
- `LOCATION_NOT_FOUND` - Location does not exist
- `UNAUTHORIZED_ACCESS` - Admin access required
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Booking endpoints**: 10 requests per minute per IP
- **Admin endpoints**: 200 requests per 15 minutes per IP

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642681200
```

## Data Validation

All endpoints implement comprehensive input validation:

- **String fields**: HTML entities escaped, length limits enforced
- **Numeric fields**: Range validation applied
- **Date/Time fields**: Format and logical validation
- **Phone numbers**: Indian mobile number format (10 digits)
- **Required fields**: Presence validation with clear error messages

## Pagination

List endpoints support pagination:

- `limit`: Number of results per page (default: 50, max: 100)
- `skip`: Number of results to skip
- `sort`: Sort field and direction (e.g., `date:asc`, `createdAt:desc`)

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "skip": 0,
    "hasMore": true,
    "totalPages": 3,
    "currentPage": 1
  }
}
```

## Performance

- **Response time**: Average < 100ms, 95th percentile < 200ms
- **Caching**: Static data cached for 5 minutes
- **Database indexing**: Optimized queries with proper indexes
- **Compression**: GZIP compression enabled for all responses
- **Monitoring**: Real-time performance metrics available

## Security

- **Input sanitization**: All inputs sanitized against XSS
- **SQL injection protection**: Parameterized queries used
- **Rate limiting**: Prevents abuse and DoS attacks
- **HTTPS enforcement**: All production traffic encrypted
- **Security headers**: Comprehensive security headers set
- **Session security**: Secure session management
- **CSRF protection**: Cross-site request forgery prevention

## Monitoring & Logging

- **Request logging**: All requests logged with response times
- **Error tracking**: Detailed error logs with stack traces
- **Performance monitoring**: Real-time metrics collection
- **Health checks**: Automated health monitoring
- **Alerting**: Automated alerts for critical issues

## Support

For API support or questions:
- **Documentation**: This document and inline code comments
- **Error messages**: Detailed validation and error messages
- **Logging**: Comprehensive request/response logging
- **Monitoring**: Real-time performance and health metrics
