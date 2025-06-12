const os = require('os');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// Performance metrics collector
class MetricsCollector {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                byEndpoint: new Map(),
                byMethod: new Map(),
                byStatusCode: new Map()
            },
            response_times: {
                min: Infinity,
                max: 0,
                avg: 0,
                total: 0,
                count: 0,
                p95: 0,
                p99: 0,
                samples: []
            },
            system: {
                memory: {},
                cpu: {},
                uptime: 0,
                pid: process.pid
            },
            database: {
                queries: 0,
                errors: 0,
                avg_response_time: 0
            },
            errors: {
                total: 0,
                by_type: new Map(),
                recent: []
            }
        };

        this.startTime = Date.now();
        this.intervalId = null;
        
        // Start system metrics collection
        this.startSystemMetricsCollection();
    }

    // Middleware to collect request metrics
    collectRequestMetrics() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Track request start
            this.metrics.requests.total++;
            
            // Track by method
            const method = req.method;
            this.metrics.requests.byMethod.set(
                method, 
                (this.metrics.requests.byMethod.get(method) || 0) + 1
            );
            
            // Track by endpoint
            const endpoint = req.route ? req.route.path : req.path;
            this.metrics.requests.byEndpoint.set(
                endpoint,
                (this.metrics.requests.byEndpoint.get(endpoint) || 0) + 1
            );

            // Override res.end to capture response metrics
            const originalEnd = res.end;
            res.end = (...args) => {
                const duration = Date.now() - startTime;
                
                // Update response time metrics
                this.updateResponseTimeMetrics(duration);
                
                // Track by status code
                const statusCode = res.statusCode;
                this.metrics.requests.byStatusCode.set(
                    statusCode,
                    (this.metrics.requests.byStatusCode.get(statusCode) || 0) + 1
                );
                
                // Track success/failure
                if (statusCode >= 200 && statusCode < 400) {
                    this.metrics.requests.successful++;
                } else {
                    this.metrics.requests.failed++;
                }
                
                // Add request metadata
                req.responseTime = duration;
                req.metricsCollected = true;
                
                originalEnd.apply(res, args);
            };
            
            next();
        };
    }

    // Update response time statistics
    updateResponseTimeMetrics(duration) {
        const rt = this.metrics.response_times;
        
        rt.total += duration;
        rt.count++;
        rt.avg = rt.total / rt.count;
        rt.min = Math.min(rt.min, duration);
        rt.max = Math.max(rt.max, duration);
        
        // Keep samples for percentile calculation (max 1000 samples)
        rt.samples.push(duration);
        if (rt.samples.length > 1000) {
            rt.samples.shift();
        }
        
        // Calculate percentiles
        if (rt.samples.length > 0) {
            const sorted = [...rt.samples].sort((a, b) => a - b);
            rt.p95 = sorted[Math.floor(sorted.length * 0.95)];
            rt.p99 = sorted[Math.floor(sorted.length * 0.99)];
        }
    }

    // Start collecting system metrics
    startSystemMetricsCollection() {
        this.intervalId = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds
        
        // Initial collection
        this.collectSystemMetrics();
    }

    // Collect system performance metrics
    collectSystemMetrics() {
        // Memory metrics
        const memUsage = process.memoryUsage();
        this.metrics.system.memory = {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            arrayBuffers: memUsage.arrayBuffers,
            free: os.freemem(),
            total: os.totalmem(),
            usage_percent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        };

        // CPU metrics
        const cpus = os.cpus();
        this.metrics.system.cpu = {
            count: cpus.length,
            model: cpus[0]?.model || 'Unknown',
            load_avg: os.loadavg(),
            usage_percent: this.calculateCpuUsage()
        };

        // Uptime
        this.metrics.system.uptime = {
            process: process.uptime(),
            system: os.uptime(),
            application: (Date.now() - this.startTime) / 1000
        };
    }

    // Calculate CPU usage percentage
    calculateCpuUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);
        
        return usage;
    }

    // Record database query metrics
    recordDatabaseQuery(duration, success = true) {
        this.metrics.database.queries++;
        if (!success) {
            this.metrics.database.errors++;
        }
        
        // Update average response time
        const current = this.metrics.database.avg_response_time;
        const count = this.metrics.database.queries;
        this.metrics.database.avg_response_time = 
            ((current * (count - 1)) + duration) / count;
    }

    // Record error occurrence
    recordError(error, req = null) {
        this.metrics.errors.total++;
        
        const errorType = error.constructor.name;
        this.metrics.errors.by_type.set(
            errorType,
            (this.metrics.errors.by_type.get(errorType) || 0) + 1
        );
        
        // Keep recent errors (max 50)
        const errorData = {
            message: error.message,
            type: errorType,
            timestamp: new Date().toISOString(),
            endpoint: req ? req.path : null,
            method: req ? req.method : null,
            stack: error.stack
        };
        
        this.metrics.errors.recent.push(errorData);
        if (this.metrics.errors.recent.length > 50) {
            this.metrics.errors.recent.shift();
        }
    }

    // Get current metrics snapshot
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: new Date().toISOString(),
            requests: {
                ...this.metrics.requests,
                byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
                byMethod: Object.fromEntries(this.metrics.requests.byMethod),
                byStatusCode: Object.fromEntries(this.metrics.requests.byStatusCode)
            },
            errors: {
                ...this.metrics.errors,
                by_type: Object.fromEntries(this.metrics.errors.by_type)
            }
        };
    }

    // Get health status
    getHealthStatus() {
        const memUsage = parseFloat(this.metrics.system.memory.usage_percent);
        const cpuUsage = this.metrics.system.cpu.usage_percent;
        const errorRate = this.metrics.requests.total > 0 ? 
            (this.metrics.requests.failed / this.metrics.requests.total) * 100 : 0;
        
        let status = 'healthy';
        const issues = [];
        
        if (memUsage > 90) {
            status = 'critical';
            issues.push('High memory usage');
        } else if (memUsage > 80) {
            status = 'warning';
            issues.push('Elevated memory usage');
        }
        
        if (cpuUsage > 90) {
            status = 'critical';
            issues.push('High CPU usage');
        } else if (cpuUsage > 80) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push('Elevated CPU usage');
        }
        
        if (errorRate > 10) {
            status = 'critical';
            issues.push('High error rate');
        } else if (errorRate > 5) {
            status = status === 'critical' ? 'critical' : 'warning';
            issues.push('Elevated error rate');
        }
        
        return {
            status,
            issues,
            metrics: {
                memory_usage: `${memUsage}%`,
                cpu_usage: `${cpuUsage}%`,
                error_rate: `${errorRate.toFixed(2)}%`,
                uptime: `${this.metrics.system.uptime.application}s`,
                total_requests: this.metrics.requests.total,
                avg_response_time: `${this.metrics.response_times.avg.toFixed(2)}ms`
            }
        };
    }

    // Export metrics to file
    async exportMetrics(filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = filename || path.join(process.cwd(), `metrics-${timestamp}.json`);
        
        try {
            const metrics = this.getMetrics();
            await promisify(fs.writeFile)(filepath, JSON.stringify(metrics, null, 2));
            return filepath;
        } catch (error) {
            throw new Error(`Failed to export metrics: ${error.message}`);
        }
    }

    // Reset metrics
    reset() {
        this.metrics.requests = {
            total: 0,
            successful: 0,
            failed: 0,
            byEndpoint: new Map(),
            byMethod: new Map(),
            byStatusCode: new Map()
        };
        
        this.metrics.response_times = {
            min: Infinity,
            max: 0,
            avg: 0,
            total: 0,
            count: 0,
            p95: 0,
            p99: 0,
            samples: []
        };
        
        this.metrics.database = {
            queries: 0,
            errors: 0,
            avg_response_time: 0
        };
        
        this.metrics.errors = {
            total: 0,
            by_type: new Map(),
            recent: []
        };
    }

    // Cleanup
    destroy() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

// Create singleton instance
const metricsCollector = new MetricsCollector();

// Graceful shutdown
process.on('SIGTERM', () => {
    metricsCollector.destroy();
});

process.on('SIGINT', () => {
    metricsCollector.destroy();
});

module.exports = metricsCollector;