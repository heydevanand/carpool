const logger = require('./logger');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Override res.end to capture timing
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const endTime = Date.now();
    const diff = process.hrtime(startHrTime);
    const duration = diff[0] * 1000 + diff[1] * 1e-6; // Convert to milliseconds

    // Log slow requests (over 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected:', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    // Log all requests in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Request completed:', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode
      });
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    
    originalEnd.apply(this, args);
  };

  next();
};

// Memory usage monitoring
const memoryMonitor = () => {
  const usage = process.memoryUsage();
  const formatBytes = (bytes) => {
    return Math.round(bytes / 1024 / 1024 * 100) / 100 + ' MB';
  };

  return {
    rss: formatBytes(usage.rss), // Resident Set Size
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    external: formatBytes(usage.external),
    arrayBuffers: formatBytes(usage.arrayBuffers)
  };
};

// CPU usage estimation
let lastCpuUsage = process.cpuUsage();
const getCpuUsage = () => {
  const currentUsage = process.cpuUsage(lastCpuUsage);
  lastCpuUsage = process.cpuUsage();
  
  const userPercent = (currentUsage.user / 1000000) * 100; // Convert microseconds to percentage
  const systemPercent = (currentUsage.system / 1000000) * 100;
  
  return {
    user: Math.round(userPercent * 100) / 100,
    system: Math.round(systemPercent * 100) / 100,
    total: Math.round((userPercent + systemPercent) * 100) / 100
  };
};

// Health check data collector
const getHealthMetrics = () => {
  return {
    uptime: Math.floor(process.uptime()),
    memory: memoryMonitor(),
    cpu: getCpuUsage(),
    pid: process.pid,
    version: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  performanceMonitor,
  memoryMonitor,
  getCpuUsage,
  getHealthMetrics
};
