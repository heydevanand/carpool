const path = require('path');
const fs = require('fs');

// Environment-specific configurations
const environments = {
  development: {
    // Server configuration
    server: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || 'localhost',
      environment: 'development',
      logLevel: 'debug',
      cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true
      }
    },

    // Database configuration
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/carpool_dev',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        bufferMaxEntries: 0,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000
      },
      debug: true
    },

    // Session configuration
    session: {
      secret: process.env.SESSION_SECRET || 'dev-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true
      },
      name: 'carpool.sid'
    },

    // Security settings
    security: {
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Requests per window
        skipSuccessfulRequests: true
      },
      helmet: {
        contentSecurityPolicy: false, // Disabled for development
        crossOriginEmbedderPolicy: false
      },
      bcrypt: {
        saltRounds: 10
      }
    },

    // Performance settings
    performance: {
      compression: {
        level: 6,
        threshold: 1024
      },
      cache: {
        ttl: 300, // 5 minutes
        checkperiod: 60 // Check for expired keys every minute
      },
      pagination: {
        defaultLimit: 50,
        maxLimit: 100
      }
    },

    // Logging configuration
    logging: {
      level: 'debug',
      format: 'combined',
      files: {
        error: path.join(process.cwd(), 'logs/error.log'),
        combined: path.join(process.cwd(), 'logs/combined.log'),
        access: path.join(process.cwd(), 'logs/access.log')
      },
      console: true,
      colorize: true
    },

    // Monitoring settings
    monitoring: {
      metricsInterval: 30000, // 30 seconds
      healthCheck: {
        timeout: 5000,
        interval: 60000 // 1 minute
      },
      alerts: {
        enabled: false,
        thresholds: {
          errorRate: 10,
          responseTime: 1000,
          memoryUsage: 85,
          cpuUsage: 85
        }
      }
    }
  },

  test: {
    // Server configuration
    server: {
      port: process.env.PORT || 3001,
      host: process.env.HOST || 'localhost',
      environment: 'test',
      logLevel: 'error',
      cors: {
        origin: ['http://localhost:3001'],
        credentials: true
      }
    },

    // Database configuration
    database: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/carpool_test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 5,
        bufferMaxEntries: 0,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000
      },
      debug: false
    },

    // Session configuration
    session: {
      secret: process.env.SESSION_SECRET || 'test-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 60 * 60 * 1000, // 1 hour
        httpOnly: true
      },
      name: 'carpool.test.sid'
    },

    // Security settings
    security: {
      rateLimiting: {
        windowMs: 1 * 60 * 1000, // 1 minute
        max: 1000, // High limit for testing
        skipSuccessfulRequests: true
      },
      helmet: {
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
      },
      bcrypt: {
        saltRounds: 4 // Faster for testing
      }
    },

    // Performance settings
    performance: {
      compression: {
        level: 1,
        threshold: 0
      },
      cache: {
        ttl: 60, // 1 minute
        checkperiod: 10
      },
      pagination: {
        defaultLimit: 10,
        maxLimit: 50
      }
    },

    // Logging configuration
    logging: {
      level: 'error',
      format: 'tiny',
      files: {
        error: path.join(process.cwd(), 'logs/test-error.log'),
        combined: path.join(process.cwd(), 'logs/test-combined.log'),
        access: path.join(process.cwd(), 'logs/test-access.log')
      },
      console: false,
      colorize: false
    },

    // Monitoring settings
    monitoring: {
      metricsInterval: 10000, // 10 seconds
      healthCheck: {
        timeout: 2000,
        interval: 30000 // 30 seconds
      },
      alerts: {
        enabled: false,
        thresholds: {
          errorRate: 50,
          responseTime: 5000,
          memoryUsage: 95,
          cpuUsage: 95
        }
      }
    }
  },

  production: {
    // Server configuration
    server: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || '0.0.0.0',
      environment: 'production',
      logLevel: 'info',
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? 
          process.env.ALLOWED_ORIGINS.split(',') : 
          ['https://your-domain.com'],
        credentials: true
      }
    },

    // Database configuration
    database: {
      uri: process.env.MONGODB_URI,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 20,
        bufferMaxEntries: 0,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        w: 'majority'
      },
      debug: false
    },

    // Session configuration
    session: {
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // HTTPS only
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
        httpOnly: true,
        sameSite: 'strict'
      },
      name: 'carpool.sid'
    },

    // Security settings
    security: {
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Requests per window
        skipSuccessfulRequests: false,
        standardHeaders: true,
        legacyHeaders: false
      },
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: true,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      },
      bcrypt: {
        saltRounds: 12
      }
    },

    // Performance settings
    performance: {
      compression: {
        level: 9,
        threshold: 1024
      },
      cache: {
        ttl: 3600, // 1 hour
        checkperiod: 300 // 5 minutes
      },
      pagination: {
        defaultLimit: 20,
        maxLimit: 100
      }
    },

    // Logging configuration
    logging: {
      level: 'info',
      format: 'combined',
      files: {
        error: path.join(process.cwd(), 'logs/error.log'),
        combined: path.join(process.cwd(), 'logs/combined.log'),
        access: path.join(process.cwd(), 'logs/access.log')
      },
      console: false,
      colorize: false,
      maxSize: '20m',
      maxFiles: '14d'
    },

    // Monitoring settings
    monitoring: {
      metricsInterval: 60000, // 1 minute
      healthCheck: {
        timeout: 10000,
        interval: 30000 // 30 seconds
      },
      alerts: {
        enabled: true,
        thresholds: {
          errorRate: 5,
          responseTime: 500,
          memoryUsage: 80,
          cpuUsage: 80
        },
        endpoints: {
          webhook: process.env.ALERT_WEBHOOK_URL,
          email: process.env.ALERT_EMAIL
        }
      }
    }
  }
};

// Configuration utility class
class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.config = this.loadConfiguration();
    this.validateConfiguration();
    this.createDirectories();
  }

  // Load environment-specific configuration
  loadConfiguration() {
    const envConfig = environments[this.env];
    if (!envConfig) {
      throw new Error(`Unknown environment: ${this.env}`);
    }

    // Deep merge with default configuration
    return this.deepMerge(environments.development, envConfig);
  }

  // Deep merge two objects
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  // Validate required configuration
  validateConfiguration() {
    const required = [
      'database.uri',
      'session.secret'
    ];

    // Only validate in production
    if (this.env === 'production') {
      required.forEach(path => {
        if (!this.get(path)) {
          throw new Error(`Required configuration missing: ${path}`);
        }
      });

      // Validate session secret strength in production
      if (this.get('session.secret').length < 32) {
        throw new Error('Session secret must be at least 32 characters in production');
      }
    }
  }

  // Create necessary directories
  createDirectories() {
    const logsDir = path.dirname(this.config.logging.files.error);
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  // Get configuration value by path
  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }

  // Set configuration value by path
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, this.config);
    
    target[lastKey] = value;
  }

  // Get all configuration
  getAll() {
    return { ...this.config };
  }

  // Get environment
  getEnvironment() {
    return this.env;
  }

  // Check if development environment
  isDevelopment() {
    return this.env === 'development';
  }

  // Check if test environment
  isTest() {
    return this.env === 'test';
  }

  // Check if production environment
  isProduction() {
    return this.env === 'production';
  }

  // Get database configuration
  getDatabaseConfig() {
    return this.config.database;
  }

  // Get server configuration
  getServerConfig() {
    return this.config.server;
  }

  // Get security configuration
  getSecurityConfig() {
    return this.config.security;
  }

  // Get logging configuration
  getLoggingConfig() {
    return this.config.logging;
  }

  // Get monitoring configuration
  getMonitoringConfig() {
    return this.config.monitoring;
  }

  // Get performance configuration
  getPerformanceConfig() {
    return this.config.performance;
  }

  // Export configuration for debugging
  exportConfig(includeSecrets = false) {
    const config = { ...this.config };
    
    if (!includeSecrets) {
      // Remove sensitive information
      config.session.secret = '[HIDDEN]';
      config.database.uri = config.database.uri.replace(/\/\/.*@/, '//[HIDDEN]@');
    }
    
    return config;
  }

  // Reload configuration (useful for testing)
  reload() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }
}

// Create singleton instance
const configManager = new ConfigManager();

// Export both the manager and direct access to config
module.exports = {
  configManager,
  config: configManager.getAll(),
  
  // Convenience exports
  database: configManager.getDatabaseConfig(),
  server: configManager.getServerConfig(),
  security: configManager.getSecurityConfig(),
  logging: configManager.getLoggingConfig(),
  monitoring: configManager.getMonitoringConfig(),
  performance: configManager.getPerformanceConfig(),
  
  // Environment helpers
  isDevelopment: configManager.isDevelopment(),
  isTest: configManager.isTest(),
  isProduction: configManager.isProduction(),
  environment: configManager.getEnvironment()
};
