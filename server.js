const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const moment = require('moment');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://heydevanand:engineerdev@dev-cluster.okxr9gy.mongodb.net/pg-carpool?retryWrites=true&w=majority&appName=Dev-Cluster';

// Configure mongoose for serverless environment
mongoose.set('bufferCommands', false);

let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connections[0].readyState === 1) {
    return;
  }
  
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 1, // Maintain up to 1 socket connection for serverless
    });
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    isConnected = false;
    throw err;
  }
};

// Database connection middleware
const ensureDBConnection = async (req, res, next) => {
  try {
    if (!isConnected || mongoose.connections[0].readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
};

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'pg-carpool-admin-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for now to test
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ensure database connection for all routes
app.use(ensureDBConnection);

// Models
const Location = require('./models/Location');
const Ride = require('./models/Ride');

// Routes
app.use('/', require('./routes/index'));
app.use('/api', require('./routes/api'));
const adminRoutes = require('./routes/admin');
app.use('/admin', adminRoutes);

// Scheduled cleanup job - runs daily at 2 AM
const scheduleCleanup = () => {
  const runCleanup = async () => {
    try {
      if (adminRoutes.cleanupOldArchivedRides) {
        const deletedCount = await adminRoutes.cleanupOldArchivedRides();
        console.log(`Daily cleanup completed: ${deletedCount} archived rides deleted`);
      }
    } catch (error) {
      console.error('Daily cleanup error:', error);
    }
  };

  // Run cleanup immediately if it's past 2 AM today, otherwise wait until 2 AM
  const now = new Date();
  const today2AM = new Date();
  today2AM.setHours(2, 0, 0, 0);
  
  let nextCleanup = today2AM;
  if (now > today2AM) {
    // If it's already past 2 AM today, schedule for tomorrow
    nextCleanup = new Date(today2AM.getTime() + 24 * 60 * 60 * 1000);
  }
  
  const timeUntilCleanup = nextCleanup.getTime() - now.getTime();
  
  setTimeout(() => {
    runCleanup();
    // Then schedule it to run every 24 hours
    setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }, timeUntilCleanup);
  
  console.log(`Cleanup scheduled for: ${nextCleanup.toLocaleString()}`);
};

// Start cleanup scheduler (only in development environment)
if (process.env.NODE_ENV !== 'production') {
  scheduleCleanup();
}

// Start server (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
