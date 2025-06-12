const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

// Security middleware configuration
const securityConfig = {
  // Rate limiting configurations
  rateLimits: {
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // More restrictive for API
      message: {
        error: 'API rate limit exceeded, please try again later.',
        retryAfter: '15 minutes'
      }
    },
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Very restrictive for authentication
      message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
      },
      skipSuccessfulRequests: true
    }
  },

  // Helmet security configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }
};

// Create rate limiters
const globalLimiter = rateLimit(securityConfig.rateLimits.global);
const apiLimiter = rateLimit(securityConfig.rateLimits.api);
const authLimiter = rateLimit(securityConfig.rateLimits.auth);

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS patterns
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  
  next();
};

// CSRF token generation and validation
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const csrfProtection = (req, res, next) => {
  if (req.method === 'GET') {
    // Generate and set CSRF token for GET requests
    const token = generateCSRFToken();
    req.session.csrfToken = token;
    res.locals.csrfToken = token;
    return next();
  }

  // Validate CSRF token for state-changing requests
  const token = req.body._csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token'
    });
  }

  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  next();
};

// IP whitelist middleware (for admin routes)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      return next(); // Skip in development
    }

    const clientIP = req.ip || req.connection.remoteAddress;
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = forwarded ? forwarded.split(',')[0].trim() : clientIP;

    if (allowedIPs.length > 0 && !allowedIPs.includes(realIP)) {
      return res.status(403).json({
        error: 'Access denied from this IP address'
      });
    }

    next();
  };
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      responseTime: duration,
      contentLength: res.get('Content-Length') || 0
    };

    // Log suspicious activity
    if (res.statusCode >= 400) {
      console.warn('Security Event:', logData);
    }
  });

  next();
};

// Export security middleware functions
module.exports = {
  // Rate limiters
  globalLimiter,
  apiLimiter,
  authLimiter,
  
  // Security middleware
  helmet: helmet(securityConfig.helmet),
  sanitizeInput,
  csrfProtection,
  securityHeaders,
  ipWhitelist,
  securityLogger,
  
  // Utility functions
  generateCSRFToken,
  
  // Configuration
  config: securityConfig
};