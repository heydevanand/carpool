# JS Palace Carpool Management System

A smart PG ↔ Office transportation system with GPS-based location detection and automatic ride archiving.

## Features

### For Residents:
- **GPS Auto-Detection**: Automatically detects if you're at PG or Office and suggests journey type
- **Smart Journey Types**: 
  - TO Office (Morning): From PG to various office locations
  - FROM Office (Evening): From office back to PG
- **Dynamic Field Labels**: "Drop Location" for morning trips, "Pickup Location" for evening trips
- **15-Minute Time Slots**: Available between 8:00 AM - 8:00 PM in 15-minute intervals
- **Real-time Updates**: Automatic refresh and live ride status
- **Auto-Archiving**: Past rides automatically archived to keep interface clean

### For Admins:
- **Clean Dashboard**: Shows only future or current rides (archived rides hidden)
- **Single Delete Action**: One "Delete" button per ride that archives instead of permanently deleting
- **Location Management**: Manage PG and office locations
- **Automatic Cleanup**: System automatically cleans up old archived rides

## Key Benefits

- **Optimized Vehicle Usage**: Reduces trips with only 1-2 passengers
- **No Approval Required**: Instant ride creation and joining
- **Location-based**: Predefined locations for consistency
- **Real-time Coordination**: Live updates for all users

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas with auto-archiving
- **Frontend**: EJS templates, Bootstrap 5, GPS-enabled JavaScript
- **GPS Integration**: HTML5 Geolocation API with PG proximity detection
- **Time Management**: Moment.js for UTC time handling

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Setup Locations** (add PG and office locations):
   ```bash
   npm run setup-locations
   ```

3. **Create Admin User**:
   ```bash
   npm run create-admin
   ```

4. **Start the Application**:
   ```bash
   npm start
   ```
   Or for development:
   ```bash
   npm run dev
   ```

4. **Access the Application**:
   - User Interface: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin
   - Manage Locations: http://localhost:3000/admin/locations

## Database Configuration

The application is configured to use MongoDB Atlas with the provided connection string. The database name is `pg-carpool`.

## Current Locations

### PG Locations:
- **Nayi PG**: GPS coordinates for automatic detection
- **Puraani PG**: GPS coordinates for automatic detection

### Office Locations:
- ABC Gol Chakkar
- ABC Theka  
- Advant
- Branch Office
- Candor Gate No. 3
- Corporate Office
- Main Office

## Usage Workflow

### For Residents:
1. Open the website (GPS will auto-detect your location)
2. Journey type will be suggested based on your location:
   - Near PG → "TO Office" with drop location selection
   - Away from PG → "FROM Office" with pickup location selection
3. Select your preferred date/time (15-minute intervals, 8 AM - 8 PM)
4. Submit ride request or join existing rides
5. View passenger contact information for coordination

### For Admins:
1. Login to admin dashboard at `/admin`
2. View only future/current rides (past rides auto-archived)
3. Use single "Delete" button to archive rides
4. Manage locations through admin panel
5. System automatically cleans up old data

## API Endpoints

- `GET /api/rides` - Get all available rides
- `POST /api/rides` - Create a new ride
- `POST /api/rides/:id/join` - Join an existing ride
- `PUT /api/rides/:id/status` - Update ride status (admin)

## File Structure

```
├── server.js              # Main application server with auto-archiving
├── package.json           # Dependencies and scripts
├── create-admin.js        # Admin user creation utility
├── setup-locations.js     # PG and office location setup
├── models/               # MongoDB models
│   ├── Admin.js          # Admin user model
│   ├── Location.js       # Location model
│   └── Ride.js          # Ride model with auto-archiving
├── routes/              # Express routes
│   ├── index.js         # User-facing routes
│   ├── api.js           # API endpoints with auto-archiving
│   └── admin.js         # Admin routes with cleanup functions
├── views/               # EJS templates
│   ├── index.ejs        # Main GPS-enabled interface
│   └── admin/           # Admin templates
│       ├── dashboard.ejs # Clean admin dashboard
│       ├── locations.ejs # Location management
│       └── login.ejs    # Admin login
└── public/              # Static assets
    └── js/main.js       # GPS detection and UI logic
```

## Key Features Implemented

- **Auto-Archiving**: Rides automatically archived 10 minutes after departure time
- **GPS Detection**: 500m radius detection for PG locations with auto-journey-type selection
- **Clean UI**: Hidden PG selection (auto-selected), dynamic field labels
- **Time Restrictions**: 8 AM - 8 PM only, 15-minute intervals
- **Admin Cleanup**: Single delete button, automatic old data cleanup
- **Timezone Handling**: UTC time display to prevent timezone shifts
