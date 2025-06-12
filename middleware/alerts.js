/**
 * Monitoring Alerts System
 * Automated monitoring and alerting for production issues
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');
const { config } = require('../config/environment');

class AlertManager {
    constructor() {
        this.emailTransporter = null;
        this.alertThresholds = {
            errorRate: config.monitoring?.alerts?.thresholds?.errorRate || 5, // %
            responseTime: config.monitoring?.alerts?.thresholds?.responseTime || 1000, // ms
            memoryUsage: config.monitoring?.alerts?.thresholds?.memoryUsage || 85, // %
            cpuUsage: config.monitoring?.alerts?.thresholds?.cpuUsage || 85, // %
            diskUsage: config.monitoring?.alerts?.thresholds?.diskUsage || 90, // %
            dbConnectionErrors: 5, // count in 5 minutes
            consecutiveFailures: 3 // consecutive health check failures
        };
        
        this.alertHistory = new Map();
        this.suppressionPeriod = 15 * 60 * 1000; // 15 minutes
        this.healthCheckFailures = 0;
        this.lastHealthStatus = 'healthy';
        
        this.metrics = {
            alertsSent: 0,
            alertsSuppressed: 0,
            lastAlert: null,
            activeAlerts: new Set()
        };
    }

    /**
     * Initialize alert system
     */
    async initialize() {
        try {
            await this.setupEmailTransporter();
            this.startMonitoring();
            
            logger.info('🚨 Alert system initialized');
        } catch (error) {
            logger.error('❌ Failed to initialize alert system:', error);
        }
    }

    /**
     * Setup email transporter
     */
    async setupEmailTransporter() {
        if (!config.monitoring?.alerts?.enabled) {
            logger.info('📧 Email alerts disabled in configuration');
            return;
        }

        const emailConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };

        if (!emailConfig.host || !emailConfig.auth.user) {
            logger.warn('⚠️ Email configuration incomplete, email alerts disabled');
            return;
        }

        try {
            this.emailTransporter = nodemailer.createTransporter(emailConfig);
            await this.emailTransporter.verify();
            logger.info('✅ Email transporter configured successfully');
        } catch (error) {
            logger.warn('⚠️ Email transporter verification failed:', error.message);
            this.emailTransporter = null;
        }
    }

    /**
     * Start monitoring process
     */
    startMonitoring() {
        // Monitor every 30 seconds
        setInterval(() => {
            this.checkSystemHealth();
        }, 30000);

        // Monitor every 5 minutes for trends
        setInterval(() => {
            this.checkTrends();
        }, 5 * 60 * 1000);

        logger.info('🔍 Monitoring started');
    }

    /**
     * Check system health and trigger alerts
     */
    async checkSystemHealth() {
        try {
            const metricsCollector = require('./metrics');
            const metrics = metricsCollector.getMetrics();
            const healthStatus = metricsCollector.getHealthStatus();

            // Check error rate
            await this.checkErrorRate(metrics);
            
            // Check response time
            await this.checkResponseTime(metrics);
            
            // Check system resources
            await this.checkSystemResources(metrics);
            
            // Check database health
            await this.checkDatabaseHealth();
            
            // Check overall health status
            await this.checkOverallHealth(healthStatus);
            
            // Update health check status
            if (healthStatus.status === 'healthy') {
                this.healthCheckFailures = 0;
            } else {
                this.healthCheckFailures++;
            }
            
            this.lastHealthStatus = healthStatus.status;
            
        } catch (error) {
            logger.error('❌ Health check monitoring error:', error);
            await this.sendAlert('system', 'critical', 'Health Check Failed', 
                `System health monitoring failed: ${error.message}`);
        }
    }

    /**
     * Check error rate threshold
     */
    async checkErrorRate(metrics) {
        const totalRequests = metrics.requests.total;
        const failedRequests = metrics.requests.failed;
        
        if (totalRequests > 0) {
            const errorRate = (failedRequests / totalRequests) * 100;
            
            if (errorRate > this.alertThresholds.errorRate) {
                await this.sendAlert('error_rate', 'high', 'High Error Rate Detected',
                    `Error rate is ${errorRate.toFixed(2)}% (threshold: ${this.alertThresholds.errorRate}%)\n` +
                    `Total requests: ${totalRequests}\n` +
                    `Failed requests: ${failedRequests}`);
            }
        }
    }

    /**
     * Check response time threshold
     */
    async checkResponseTime(metrics) {
        const avgResponseTime = metrics.response_times.avg;
        const p95ResponseTime = metrics.response_times.p95;
        
        if (avgResponseTime > this.alertThresholds.responseTime) {
            await this.sendAlert('response_time', 'medium', 'Slow Response Time',
                `Average response time is ${avgResponseTime.toFixed(2)}ms (threshold: ${this.alertThresholds.responseTime}ms)\n` +
                `95th percentile: ${p95ResponseTime.toFixed(2)}ms`);
        }
    }

    /**
     * Check system resource thresholds
     */
    async checkSystemResources(metrics) {
        const memoryUsage = parseFloat(metrics.system.memory.usage_percent);
        const cpuUsage = metrics.system.cpu.usage_percent;
        
        // Memory usage alert
        if (memoryUsage > this.alertThresholds.memoryUsage) {
            await this.sendAlert('memory', 'high', 'High Memory Usage',
                `Memory usage is ${memoryUsage.toFixed(2)}% (threshold: ${this.alertThresholds.memoryUsage}%)\n` +
                `Heap used: ${(metrics.system.memory.heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
                `Heap total: ${(metrics.system.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
        }
        
        // CPU usage alert
        if (cpuUsage > this.alertThresholds.cpuUsage) {
            await this.sendAlert('cpu', 'high', 'High CPU Usage',
                `CPU usage is ${cpuUsage.toFixed(2)}% (threshold: ${this.alertThresholds.cpuUsage}%)\n` +
                `Load average: ${metrics.system.cpu.load_avg.join(', ')}`);
        }
    }

    /**
     * Check database health
     */
    async checkDatabaseHealth() {
        try {
            const mongoose = require('mongoose');
            
            if (mongoose.connection.readyState !== 1) {
                await this.sendAlert('database', 'critical', 'Database Connection Lost',
                    `Database connection state: ${mongoose.connection.readyState}\n` +
                    'Application may experience data access issues.');
            }
            
        } catch (error) {
            await this.sendAlert('database', 'critical', 'Database Health Check Failed',
                `Database health check error: ${error.message}`);
        }
    }

    /**
     * Check overall health status
     */
    async checkOverallHealth(healthStatus) {
        if (healthStatus.status === 'critical') {
            if (this.healthCheckFailures >= this.alertThresholds.consecutiveFailures) {
                await this.sendAlert('health', 'critical', 'System Critical',
                    `System health is critical for ${this.healthCheckFailures} consecutive checks.\n` +
                    `Issues: ${healthStatus.issues.join(', ')}\n` +
                    `Metrics: ${JSON.stringify(healthStatus.metrics, null, 2)}`);
            }
        } else if (healthStatus.status === 'warning') {
            await this.sendAlert('health', 'medium', 'System Warning',
                `System health warning detected.\n` +
                `Issues: ${healthStatus.issues.join(', ')}\n` +
                `Metrics: ${JSON.stringify(healthStatus.metrics, null, 2)}`);
        }
    }

    /**
     * Check trends over time
     */
    async checkTrends() {
        try {
            // This would analyze metrics over time to detect trends
            // For now, we'll implement basic trend detection
            
            const metricsCollector = require('./metrics');
            const currentMetrics = metricsCollector.getMetrics();
            
            // Check if error rate is trending upward
            const recentErrors = currentMetrics.errors.recent.slice(-10);
            const errorTrend = this.calculateTrend(recentErrors.map(e => new Date(e.timestamp).getTime()));
            
            if (errorTrend > 0.5) { // Significant upward trend
                await this.sendAlert('trend', 'medium', 'Increasing Error Trend',
                    `Error rate is trending upward over the last period.\n` +
                    `Recent errors: ${recentErrors.length}\n` +
                    `Consider investigating potential issues.`);
            }
            
        } catch (error) {
            logger.error('❌ Trend analysis error:', error);
        }
    }

    /**
     * Calculate trend (simplified linear regression)
     */
    calculateTrend(timestamps) {
        if (timestamps.length < 2) return 0;
        
        const n = timestamps.length;
        const x = timestamps.map((_, i) => i);
        const y = timestamps;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
    }

    /**
     * Send alert
     */
    async sendAlert(type, severity, title, message) {
        const alertKey = `${type}_${severity}`;
        
        // Check if alert should be suppressed
        if (this.shouldSuppressAlert(alertKey)) {
            this.metrics.alertsSuppressed++;
            logger.debug(`Alert suppressed: ${alertKey}`);
            return;
        }
        
        const alert = {
            type,
            severity,
            title,
            message,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            server: process.env.SERVER_NAME || 'unknown'
        };
        
        try {
            // Log alert
            logger.warn(`🚨 ALERT [${severity.toUpperCase()}]: ${title}`, {
                type,
                message: message.substring(0, 200) + (message.length > 200 ? '...' : '')
            });
            
            // Send email if configured
            if (this.emailTransporter) {
                await this.sendEmailAlert(alert);
            }
            
            // Send webhook if configured
            await this.sendWebhookAlert(alert);
            
            // Update metrics
            this.metrics.alertsSent++;
            this.metrics.lastAlert = alert;
            this.metrics.activeAlerts.add(alertKey);
            
            // Record alert history
            this.alertHistory.set(alertKey, Date.now());
            
        } catch (error) {
            logger.error('❌ Failed to send alert:', error);
        }
    }

    /**
     * Check if alert should be suppressed
     */
    shouldSuppressAlert(alertKey) {
        const lastAlert = this.alertHistory.get(alertKey);
        if (!lastAlert) return false;
        
        return (Date.now() - lastAlert) < this.suppressionPeriod;
    }

    /**
     * Send email alert
     */
    async sendEmailAlert(alert) {
        if (!this.emailTransporter) return;
        
        const recipients = process.env.ALERT_EMAIL_RECIPIENTS;
        if (!recipients) {
            logger.warn('⚠️ No alert email recipients configured');
            return;
        }
        
        const emailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: recipients,
            subject: `[${alert.severity.toUpperCase()}] ${alert.title} - ${alert.environment}`,
            html: this.generateEmailTemplate(alert)
        };
        
        try {
            await this.emailTransporter.sendMail(emailOptions);
            logger.info('📧 Alert email sent successfully');
        } catch (error) {
            logger.error('❌ Failed to send alert email:', error);
        }
    }

    /**
     * Generate email template
     */
    generateEmailTemplate(alert) {
        const severityColors = {
            low: '#28a745',
            medium: '#ffc107',
            high: '#fd7e14',
            critical: '#dc3545'
        };
        
        const color = severityColors[alert.severity] || '#6c757d';
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Alert: ${alert.title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="background-color: ${color}; color: white; padding: 20px;">
                    <h1 style="margin: 0; font-size: 24px;">🚨 ${alert.title}</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">Severity: ${alert.severity.toUpperCase()}</p>
                </div>
                
                <div style="padding: 20px;">
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #333; margin-bottom: 10px;">Alert Details</h3>
                        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid ${color};">
                            <pre style="margin: 0; white-space: pre-wrap; font-family: monospace; font-size: 14px;">${alert.message}</pre>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #333; margin-bottom: 10px;">System Information</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; font-weight: bold;">Environment</td>
                                <td style="padding: 8px; border: 1px solid #dee2e6;">${alert.environment}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; font-weight: bold;">Server</td>
                                <td style="padding: 8px; border: 1px solid #dee2e6;">${alert.server}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; font-weight: bold;">Timestamp</td>
                                <td style="padding: 8px; border: 1px solid #dee2e6;">${alert.timestamp}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; border: 1px solid #dee2e6; background-color: #f8f9fa; font-weight: bold;">Alert Type</td>
                                <td style="padding: 8px; border: 1px solid #dee2e6;">${alert.type}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="background-color: #e9ecef; padding: 15px; border-radius: 4px; text-align: center;">
                        <p style="margin: 0; color: #6c757d; font-size: 14px;">
                            This is an automated alert from the Carpool monitoring system.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Send webhook alert
     */
    async sendWebhookAlert(alert) {
        const webhookUrl = process.env.ALERT_WEBHOOK_URL;
        if (!webhookUrl) return;
        
        try {
            const axios = require('axios');
            
            const payload = {
                text: `🚨 **${alert.title}**`,
                attachments: [{
                    color: this.getSeverityColor(alert.severity),
                    fields: [
                        { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                        { title: 'Type', value: alert.type, short: true },
                        { title: 'Environment', value: alert.environment, short: true },
                        { title: 'Server', value: alert.server, short: true },
                        { title: 'Message', value: alert.message, short: false }
                    ],
                    timestamp: alert.timestamp
                }]
            };
            
            await axios.post(webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            logger.info('🪝 Webhook alert sent successfully');
        } catch (error) {
            logger.error('❌ Failed to send webhook alert:', error);
        }
    }

    /**
     * Get severity color for webhooks
     */
    getSeverityColor(severity) {
        const colors = {
            low: 'good',
            medium: 'warning',
            high: 'danger',
            critical: 'danger'
        };
        return colors[severity] || 'good';
    }

    /**
     * Get alert statistics
     */
    getStats() {
        return {
            ...this.metrics,
            activeAlerts: Array.from(this.metrics.activeAlerts),
            thresholds: this.alertThresholds,
            suppressionPeriod: this.suppressionPeriod,
            healthCheckFailures: this.healthCheckFailures,
            lastHealthStatus: this.lastHealthStatus
        };
    }

    /**
     * Resolve alert
     */
    resolveAlert(alertKey) {
        this.metrics.activeAlerts.delete(alertKey);
        this.alertHistory.delete(alertKey);
        logger.info(`✅ Alert resolved: ${alertKey}`);
    }

    /**
     * Update alert thresholds
     */
    updateThresholds(newThresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
        logger.info('⚙️ Alert thresholds updated', newThresholds);
    }

    /**
     * Test alert system
     */
    async testAlerts() {
        logger.info('🧪 Testing alert system...');
        
        await this.sendAlert('test', 'low', 'Test Alert', 
            'This is a test alert to verify the alerting system is working correctly.');
        
        logger.info('✅ Test alert sent');
    }
}

// Create singleton instance
const alertManager = new AlertManager();

module.exports = alertManager;
