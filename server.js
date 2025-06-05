const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const moment = require('moment');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://heydevanand:engineerdev@dev-cluster.okxr9gy.mongodb.net/pg-carpool?retryWrites=true&w=majority&appName=Dev-Cluster';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Models
const Location = require('./models/Location');
const Ride = require('./models/Ride');

// Routes
app.use('/', require('./routes/index'));
app.use('/api', require('./routes/api'));
app.use('/admin', require('./routes/admin'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
