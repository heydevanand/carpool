const { body, validationResult } = require('express-validator');

// Validation middleware for ride creation
const validateRideCreation = [
  body('origin')
    .notEmpty()
    .withMessage('Origin is required')
    .isMongoId()
    .withMessage('Origin must be a valid location ID'),
  
  body('destination')
    .notEmpty()
    .withMessage('Destination is required')
    .isMongoId()
    .withMessage('Destination must be a valid location ID'),
  
  body('departureTime')
    .notEmpty()
    .withMessage('Departure time is required')
    .isISO8601()
    .withMessage('Invalid departure time format')
    .custom((value) => {
      const departureDate = new Date(value);
      const now = new Date();
      if (departureDate <= now) {
        throw new Error('Departure time must be in the future');
      }
      return true;
    }),
  
  body('passengerName')
    .trim()
    .notEmpty()
    .withMessage('Passenger name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Passenger name must be between 2 and 50 characters'),
  
  body('passengerPhone')
    .trim()
    .notEmpty()
    .withMessage('Passenger phone is required')
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 characters')
    .matches(/^[\d\-\+\(\)\s]+$/)
    .withMessage('Invalid phone number format'),
];

// Validation middleware for ride updates
const validateRideUpdate = [
  body('seatsAvailable')
    .optional()
    .isInt({ min: 0, max: 8 })
    .withMessage('Seats available must be between 0 and 8'),
  
  body('pricePerSeat')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price per seat must be a positive number'),
  
  body('driverLocation.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  
  body('driverLocation.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
];

// Admin login validation
const validateAdminLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

// Location validation
const validateLocation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Location name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Location name must be between 2 and 100 characters'),
  
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  
  body('coordinates.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  
  body('coordinates.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

module.exports = {
  validateRideCreation,
  validateRideUpdate,
  validateAdminLogin,
  validateLocation,
  handleValidationErrors
};
