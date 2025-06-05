# PG Carpool Management System

A minimal yet functional web application for managing carpooling services at a PG (Paying Guest) accommodation.

## Features

### For Residents:
- **View Available Rides**: See all upcoming rides with departure times, routes, and available seats
- **Join Existing Rides**: Join rides that have available space
- **Create New Rides**: Create a ride when no suitable option exists
- **Real-time Updates**: Automatic refresh every 30 seconds to show latest rides

### For PG Service Provider (Admin):
- **Dashboard**: View today's rides and upcoming rides
- **Ride Management**: Update ride status (start, complete, cancel)
- **Location Management**: Add/edit/activate/deactivate pickup/drop locations
- **Passenger Details**: View all passengers for each ride

## Key Benefits

- **Optimized Vehicle Usage**: Reduces trips with only 1-2 passengers
- **No Approval Required**: Instant ride creation and joining
- **Location-based**: Predefined locations for consistency
- **Real-time Coordination**: Live updates for all users

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Frontend**: EJS templates, Bootstrap 5, Vanilla JavaScript
- **Real-time**: Auto-refresh functionality

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Seed Database** (add initial locations):
   ```bash
   npm run seed
   ```

3. **Start the Application**:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Access the Application**:
   - User Interface: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin
   - Manage Locations: http://localhost:3000/admin/locations

## Database Configuration

The application is configured to use MongoDB Atlas with the provided connection string. The database name is `pg-carpool`.

## Default Locations

The seed script adds the following sample locations:
- PG Main Gate
- Tech Park Gate 1
- Electronic City Metro
- Koramangala BDA Complex
- Whitefield Railway Station
- HSR Layout
- Indiranagar Metro
- Brigade Road

## Usage Workflow

### For Residents:
1. Open the website
2. Check if any available ride matches your time and route
3. If yes, join the ride by providing your name and phone
4. If no suitable ride exists, create a new ride
5. Wait for others to join your ride

### For PG Service Provider:
1. Open admin dashboard to see all rides
2. Monitor ride status and passenger count
3. Start rides when it's time for departure
4. Mark rides as completed after drop-off
5. Manage locations as needed through the admin panel

## API Endpoints

- `GET /api/rides` - Get all available rides
- `POST /api/rides` - Create a new ride
- `POST /api/rides/:id/join` - Join an existing ride
- `PUT /api/rides/:id/status` - Update ride status (admin)

## File Structure

```
├── server.js              # Main application server
├── package.json           # Dependencies and scripts
├── seed.js               # Database seeding script
├── models/               # MongoDB models
│   ├── Location.js       # Location model
│   └── Ride.js          # Ride model
├── routes/              # Express routes
│   ├── index.js         # User-facing routes
│   ├── api.js           # API endpoints
│   └── admin.js         # Admin routes
├── views/               # EJS templates
│   ├── index.ejs        # Main user interface
│   └── admin/           # Admin templates
└── public/              # Static assets
    └── js/main.js       # Frontend JavaScript
```

## Future Enhancements

- Push notifications for ride updates
- GPS integration for automatic location detection
- Payment integration
- Ride history and analytics
- Mobile app version
- SMS notifications
