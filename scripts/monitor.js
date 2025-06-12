#!/usr/bin/env node

const metricsCollector = require('./middleware/metrics');
const { config } = require('./config/environment');
const mongoose = require('mongoose');

// Monitoring dashboard utility
class MonitoringDashboard {
  constructor() {
    this.isRunning = false;
    this.updateInterval = null;
  }

  // Clear screen (cross-platform)
  clearScreen() {
    process.stdout.write('\x1Bc');
  }

  // Color text utilities
  colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bright: '\x1b[1m'
  };

  colorize(text, color) {
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  // Format numbers with units
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  // Status indicators
  getStatusIndicator(status) {
    switch (status) {
      case 'healthy': 
      case 'connected':
        return this.colorize('●', 'green');
      case 'warning':
        return this.colorize('●', 'yellow');
      case 'critical':
      case 'disconnected':
        return this.colorize('●', 'red');
      default:
        return this.colorize('●', 'white');
    }
  }

  // Progress bar
  createProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    let color = 'green';
    if (percentage > 80) color = 'yellow';
    if (percentage > 90) color = 'red';
    
    return this.colorize(bar, color) + ` ${percentage.toFixed(1)}%`;
  }

  // Render dashboard header
  renderHeader() {
    const timestamp = new Date().toLocaleString();
    const env = config.server.environment.toUpperCase();
    
    console.log(this.colorize('╔══════════════════════════════════════════════════════════════════════════╗', 'cyan'));
    console.log(this.colorize('║', 'cyan') + this.colorize('                    🚗 CARPOOL MONITORING DASHBOARD                    ', 'bright') + this.colorize('║', 'cyan'));
    console.log(this.colorize('║', 'cyan') + `                    Environment: ${this.colorize(env, 'yellow')}  •  ${timestamp}                    ` + this.colorize('║', 'cyan'));
    console.log(this.colorize('╚══════════════════════════════════════════════════════════════════════════╝', 'cyan'));
    console.log();
  }

  // Render system metrics
  renderSystemMetrics(healthStatus) {
    console.log(this.colorize('📊 SYSTEM METRICS', 'bright'));
    console.log('─'.repeat(80));
    
    const memUsage = parseFloat(healthStatus.metrics.memory_usage.replace('%', ''));
    const cpuUsage = parseFloat(healthStatus.metrics.cpu_usage.replace('%', ''));
    
    console.log(`Memory Usage: ${this.createProgressBar(memUsage)} (${this.formatBytes(process.memoryUsage().heapUsed)}/${this.formatBytes(process.memoryUsage().heapTotal)})`);
    console.log(`CPU Usage:    ${this.createProgressBar(cpuUsage)}`);
    console.log(`Uptime:       ${this.colorize(this.formatDuration(process.uptime()), 'cyan')}`);
    console.log(`Process ID:   ${this.colorize(process.pid, 'white')}`);
    console.log(`Node Version: ${this.colorize(process.version, 'white')}`);
    console.log();
  }

  // Render application metrics
  renderApplicationMetrics(metrics) {
    console.log(this.colorize('🔄 APPLICATION METRICS', 'bright'));
    console.log('─'.repeat(80));
    
    const errorRate = parseFloat(metrics.error_rate.replace('%', ''));
    const errorColor = errorRate > 5 ? 'red' : errorRate > 2 ? 'yellow' : 'green';
    
    console.log(`Total Requests:    ${this.colorize(metrics.total_requests.toLocaleString(), 'white')}`);
    console.log(`Average Response:  ${this.colorize(metrics.avg_response_time, 'white')}`);
    console.log(`Error Rate:        ${this.colorize(metrics.error_rate, errorColor)}`);
    console.log(`Status:            ${this.getStatusIndicator(healthStatus.status)} ${this.colorize(healthStatus.status.toUpperCase(), errorColor)}`);
    
    if (healthStatus.issues && healthStatus.issues.length > 0) {
      console.log(`Issues:            ${this.colorize(healthStatus.issues.join(', '), 'red')}`);
    }
    
    console.log();
  }

  // Render database metrics
  async renderDatabaseMetrics() {
    console.log(this.colorize('🗄️  DATABASE METRICS', 'bright'));
    console.log('─'.repeat(80));
    
    try {
      const dbState = mongoose.connection.readyState;
      const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      const state = states[dbState] || 'unknown';
      
      console.log(`Connection:   ${this.getStatusIndicator(state)} ${this.colorize(state.toUpperCase(), state === 'connected' ? 'green' : 'red')}`);
      
      if (state === 'connected') {
        const dbStartTime = Date.now();
        await mongoose.connection.db.admin().ping();
        const ping = Date.now() - dbStartTime;
        
        console.log(`Ping:         ${this.colorize(`${ping}ms`, ping < 50 ? 'green' : ping < 100 ? 'yellow' : 'red')}`);
        console.log(`Database:     ${this.colorize(mongoose.connection.name, 'white')}`);
        console.log(`Host:         ${this.colorize(mongoose.connection.host, 'white')}`);
      }
    } catch (error) {
      console.log(`Error:        ${this.colorize(error.message, 'red')}`);
    }
    
    console.log();
  }

  // Render request metrics
  renderRequestMetrics(metrics) {
    console.log(this.colorize('📈 REQUEST METRICS', 'bright'));
    console.log('─'.repeat(80));
    
    // Top endpoints
    const endpoints = Object.entries(metrics.requests.byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    console.log('Top Endpoints:');
    endpoints.forEach(([endpoint, count]) => {
      const percentage = ((count / metrics.requests.total) * 100).toFixed(1);
      console.log(`  ${endpoint.padEnd(30)} ${this.colorize(count.toString().padStart(8), 'white')} (${percentage}%)`);
    });
    
    console.log();
    
    // HTTP methods
    console.log('HTTP Methods:');
    Object.entries(metrics.requests.byMethod).forEach(([method, count]) => {
      const percentage = ((count / metrics.requests.total) * 100).toFixed(1);
      const methodColor = method === 'GET' ? 'green' : method === 'POST' ? 'blue' : method === 'PUT' ? 'yellow' : 'red';
      console.log(`  ${this.colorize(method.padEnd(8), methodColor)} ${this.colorize(count.toString().padStart(8), 'white')} (${percentage}%)`);
    });
    
    console.log();
    
    // Status codes
    console.log('Status Codes:');
    Object.entries(metrics.requests.byStatusCode).forEach(([code, count]) => {
      const percentage = ((count / metrics.requests.total) * 100).toFixed(1);
      const codeColor = code.startsWith('2') ? 'green' : code.startsWith('3') ? 'cyan' : code.startsWith('4') ? 'yellow' : 'red';
      console.log(`  ${this.colorize(code.padEnd(8), codeColor)} ${this.colorize(count.toString().padStart(8), 'white')} (${percentage}%)`);
    });
    
    console.log();
  }

  // Render performance metrics
  renderPerformanceMetrics(metrics) {
    console.log(this.colorize('⚡ PERFORMANCE METRICS', 'bright'));
    console.log('─'.repeat(80));
    
    const rt = metrics.response_times;
    
    console.log(`Response Times:`);
    console.log(`  Average:      ${this.colorize(`${rt.avg.toFixed(2)}ms`, rt.avg < 100 ? 'green' : rt.avg < 500 ? 'yellow' : 'red')}`);
    console.log(`  Minimum:      ${this.colorize(`${rt.min === Infinity ? 0 : rt.min}ms`, 'white')}`);
    console.log(`  Maximum:      ${this.colorize(`${rt.max}ms`, rt.max < 1000 ? 'white' : 'red')}`);
    console.log(`  95th %ile:    ${this.colorize(`${rt.p95}ms`, rt.p95 < 200 ? 'green' : rt.p95 < 1000 ? 'yellow' : 'red')}`);
    console.log(`  99th %ile:    ${this.colorize(`${rt.p99}ms`, rt.p99 < 500 ? 'green' : rt.p99 < 2000 ? 'yellow' : 'red')}`);
    
    console.log();
  }

  // Render error metrics
  renderErrorMetrics(metrics) {
    if (metrics.errors.total === 0) {
      console.log(this.colorize('✅ NO ERRORS DETECTED', 'green'));
      console.log();
      return;
    }
    
    console.log(this.colorize('❌ ERROR METRICS', 'bright'));
    console.log('─'.repeat(80));
    
    console.log(`Total Errors: ${this.colorize(metrics.errors.total.toString(), 'red')}`);
    
    if (Object.keys(metrics.errors.by_type).length > 0) {
      console.log(`Error Types:`);
      Object.entries(metrics.errors.by_type).forEach(([type, count]) => {
        const percentage = ((count / metrics.errors.total) * 100).toFixed(1);
        console.log(`  ${type.padEnd(20)} ${this.colorize(count.toString().padStart(6), 'red')} (${percentage}%)`);
      });
    }
    
    if (metrics.errors.recent.length > 0) {
      console.log(`Recent Errors:`);
      metrics.errors.recent.slice(-3).forEach((error, i) => {
        const time = new Date(error.timestamp).toLocaleTimeString();
        console.log(`  ${time} ${this.colorize(error.type, 'red')}: ${error.message.substring(0, 60)}${error.message.length > 60 ? '...' : ''}`);
      });
    }
    
    console.log();
  }

  // Render footer with controls
  renderFooter() {
    console.log(this.colorize('─'.repeat(80), 'cyan'));
    console.log(this.colorize('Controls: ', 'bright') + 
                this.colorize('[Q]', 'yellow') + ' Quit  ' + 
                this.colorize('[R]', 'yellow') + ' Reset Metrics  ' + 
                this.colorize('[E]', 'yellow') + ' Export Metrics  ' + 
                this.colorize('[H]', 'yellow') + ' Help');
    console.log(this.colorize('Last Updated: ', 'white') + new Date().toLocaleTimeString());
  }

  // Main render function
  async render() {
    try {
      this.clearScreen();
      
      const healthStatus = metricsCollector.getHealthStatus();
      const metrics = metricsCollector.getMetrics();
      
      this.renderHeader();
      this.renderSystemMetrics(healthStatus);
      this.renderApplicationMetrics(healthStatus.metrics);
      await this.renderDatabaseMetrics();
      this.renderRequestMetrics(metrics);
      this.renderPerformanceMetrics(metrics);
      this.renderErrorMetrics(metrics);
      this.renderFooter();
      
    } catch (error) {
      console.error('Dashboard render error:', error);
    }
  }

  // Handle keyboard input
  handleInput() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', async (key) => {
      switch (key.toLowerCase()) {
        case 'q':
        case '\u0003': // Ctrl+C
          this.stop();
          process.exit(0);
          break;
        case 'r':
          metricsCollector.reset();
          console.log(this.colorize('\n✅ Metrics reset successfully!', 'green'));
          setTimeout(() => this.render(), 1000);
          break;
        case 'e':
          try {
            const filename = await metricsCollector.exportMetrics();
            console.log(this.colorize(`\n✅ Metrics exported to: ${filename}`, 'green'));
            setTimeout(() => this.render(), 2000);
          } catch (error) {
            console.log(this.colorize(`\n❌ Export failed: ${error.message}`, 'red'));
            setTimeout(() => this.render(), 2000);
          }
          break;
        case 'h':
          this.showHelp();
          setTimeout(() => this.render(), 5000);
          break;
        default:
          // Ignore other keys
          break;
      }
    });
  }

  // Show help
  showHelp() {
    this.clearScreen();
    console.log(this.colorize('🚗 CARPOOL MONITORING DASHBOARD - HELP', 'bright'));
    console.log('─'.repeat(80));
    console.log();
    console.log('The dashboard shows real-time metrics for the carpool application:');
    console.log();
    console.log(this.colorize('System Metrics:', 'yellow'));
    console.log('  • Memory and CPU usage with visual progress bars');
    console.log('  • Application uptime and process information');
    console.log();
    console.log(this.colorize('Application Metrics:', 'yellow'));
    console.log('  • Total requests processed');
    console.log('  • Average response time and error rate');
    console.log('  • Overall health status');
    console.log();
    console.log(this.colorize('Database Metrics:', 'yellow'));
    console.log('  • Connection status and ping time');
    console.log('  • Database name and host information');
    console.log();
    console.log(this.colorize('Request Metrics:', 'yellow'));
    console.log('  • Top endpoints by request count');
    console.log('  • HTTP method distribution');
    console.log('  • Status code breakdown');
    console.log();
    console.log(this.colorize('Performance Metrics:', 'yellow'));
    console.log('  • Response time statistics (avg, min, max, percentiles)');
    console.log();
    console.log(this.colorize('Error Metrics:', 'yellow'));
    console.log('  • Total error count and types');
    console.log('  • Recent error details');
    console.log();
    console.log(this.colorize('Keyboard Controls:', 'cyan'));
    console.log('  [Q] - Quit the dashboard');
    console.log('  [R] - Reset all metrics to zero');
    console.log('  [E] - Export current metrics to JSON file');
    console.log('  [H] - Show this help screen');
    console.log();
    console.log('The dashboard updates automatically every 2 seconds.');
    console.log('Press any key to return to the main dashboard...');
  }

  // Start dashboard
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(this.colorize('🚀 Starting Carpool Monitoring Dashboard...', 'green'));
    
    // Initial render
    this.render();
    
    // Set up auto-refresh
    this.updateInterval = setInterval(() => {
      this.render();
    }, 2000);
    
    // Handle keyboard input
    this.handleInput();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  // Stop dashboard
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    process.stdin.setRawMode(false);
    process.stdin.pause();
    
    this.clearScreen();
    console.log(this.colorize('👋 Carpool Monitoring Dashboard stopped.', 'cyan'));
    console.log();
  }
}

// CLI entry point
if (require.main === module) {
  const dashboard = new MonitoringDashboard();
  
  console.log(this.colorize('🔧 Initializing monitoring dashboard...', 'yellow'));
  
  // Connect to database first if not connected
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.database.uri, config.database.options)
      .then(() => {
        console.log(this.colorize('✅ Database connected', 'green'));
        dashboard.start();
      })
      .catch((error) => {
        console.error(this.colorize('❌ Database connection failed:', 'red'), error.message);
        console.log('Starting dashboard in offline mode...');
        dashboard.start();
      });
  } else {
    dashboard.start();
  }
}

module.exports = MonitoringDashboard;
