const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
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
app.use('/admin', require('./routes/admin'));

// Start server (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
