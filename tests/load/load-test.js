#!/usr/bin/env node

/**
 * Comprehensive Load Testing Suite
 * Tests system performance under various load conditions
 */

const { loadavg } = require('os');
const axios = require('axios');
const { performance } = require('perf_hooks');

class LoadTester {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.results = {
            scenarios: [],
            summary: {
                totalRequests: 0,
                totalErrors: 0,
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0,
                requestsPerSecond: 0,
                errorRate: 0,
                startTime: null,
                endTime: null,
                duration: 0
            }
        };
        this.responseTimes = [];
    }

    /**
     * Simulate concurrent users
     */
    async runConcurrencyTest(users = 50, duration = 60) {
        console.log(`\n🔥 Starting concurrency test: ${users} users for ${duration}s`);
        
        const startTime = performance.now();
        const endTime = startTime + (duration * 1000);
        const promises = [];
        const results = {
            requests: 0,
            errors: 0,
            responseTimes: []
        };

        // Start concurrent users
        for (let i = 0; i < users; i++) {
            promises.push(this.simulateUser(endTime, results, i));
        }

        await Promise.all(promises);

        const actualDuration = (performance.now() - startTime) / 1000;
        const rps = results.requests / actualDuration;

        console.log(`✅ Concurrency test completed:`);
        console.log(`   Users: ${users}`);
        console.log(`   Duration: ${actualDuration.toFixed(2)}s`);
        console.log(`   Total Requests: ${results.requests}`);
        console.log(`   Errors: ${results.errors}`);
        console.log(`   RPS: ${rps.toFixed(2)}`);
        console.log(`   Error Rate: ${((results.errors / results.requests) * 100).toFixed(2)}%`);

        return {
            scenario: 'concurrency',
            users,
            duration: actualDuration,
            requests: results.requests,
            errors: results.errors,
            rps,
            errorRate: (results.errors / results.requests) * 100,
            responseTimes: results.responseTimes
        };
    }

    /**
     * Simulate a user session
     */
    async simulateUser(endTime, results, userId) {
        while (performance.now() < endTime) {
            try {
                // Random user actions
                const actions = [
                    () => this.makeRequest('/health', 'GET'),
                    () => this.makeRequest('/api/rides', 'GET'),
                    () => this.makeRequest('/api/status', 'GET'),
                    () => this.searchRides(),
                    () => this.createRide(userId),
                ];

                const action = actions[Math.floor(Math.random() * actions.length)];
                const startTime = performance.now();
                
                await action();
                
                const responseTime = performance.now() - startTime;
                results.requests++;
                results.responseTimes.push(responseTime);
                this.responseTimes.push(responseTime);

                // Random delay between requests (0.5-3 seconds)
                const delay = 500 + Math.random() * 2500;
                await this.sleep(delay);

            } catch (error) {
                results.errors++;
                // Continue testing even on errors
            }
        }
    }

    /**
     * Test API endpoints under load
     */
    async runAPILoadTest(rps = 100, duration = 30) {
        console.log(`\n🎯 Starting API load test: ${rps} RPS for ${duration}s`);
        
        const startTime = performance.now();
        const interval = 1000 / rps; // ms between requests
        const totalRequests = rps * duration;
        const promises = [];
        const results = {
            requests: 0,
            errors: 0,
            responseTimes: []
        };

        for (let i = 0; i < totalRequests; i++) {
            const promise = new Promise(async (resolve) => {
                await this.sleep(i * interval);
                
                try {
                    const requestStart = performance.now();
                    await this.makeRequest('/api/rides', 'GET');
                    const responseTime = performance.now() - requestStart;
                    
                    results.requests++;
                    results.responseTimes.push(responseTime);
                    this.responseTimes.push(responseTime);
                } catch (error) {
                    results.errors++;
                }
                
                resolve();
            });
            
            promises.push(promise);
        }

        await Promise.all(promises);

        const actualDuration = (performance.now() - startTime) / 1000;
        const actualRps = results.requests / actualDuration;

        console.log(`✅ API load test completed:`);
        console.log(`   Target RPS: ${rps}`);
        console.log(`   Actual RPS: ${actualRps.toFixed(2)}`);
        console.log(`   Duration: ${actualDuration.toFixed(2)}s`);
        console.log(`   Total Requests: ${results.requests}`);
        console.log(`   Errors: ${results.errors}`);

        return {
            scenario: 'api-load',
            targetRps: rps,
            actualRps,
            duration: actualDuration,
            requests: results.requests,
            errors: results.errors,
            responseTimes: results.responseTimes
        };
    }

    /**
     * Test database operations under load
     */
    async runDatabaseLoadTest(concurrency = 20, operations = 1000) {
        console.log(`\n🗄️ Starting database load test: ${concurrency} concurrent, ${operations} operations`);
        
        const startTime = performance.now();
        const promises = [];
        const operationsPerWorker = Math.floor(operations / concurrency);
        const results = {
            creates: 0,
            reads: 0,
            updates: 0,
            deletes: 0,
            errors: 0,
            responseTimes: []
        };

        // Distribute operations across concurrent workers
        for (let i = 0; i < concurrency; i++) {
            promises.push(this.databaseWorker(operationsPerWorker, results, i));
        }

        await Promise.all(promises);

        const duration = (performance.now() - startTime) / 1000;
        const totalOps = results.creates + results.reads + results.updates + results.deletes;

        console.log(`✅ Database load test completed:`);
        console.log(`   Duration: ${duration.toFixed(2)}s`);
        console.log(`   Creates: ${results.creates}`);
        console.log(`   Reads: ${results.reads}`);
        console.log(`   Updates: ${results.updates}`);
        console.log(`   Deletes: ${results.deletes}`);
        console.log(`   Errors: ${results.errors}`);
        console.log(`   Ops/sec: ${(totalOps / duration).toFixed(2)}`);

        return {
            scenario: 'database-load',
            duration,
            operations: totalOps,
            errors: results.errors,
            opsPerSecond: totalOps / duration,
            breakdown: {
                creates: results.creates,
                reads: results.reads,
                updates: results.updates,
                deletes: results.deletes
            }
        };
    }

    /**
     * Database worker for load testing
     */
    async databaseWorker(operations, results, workerId) {
        const createdRides = [];

        for (let i = 0; i < operations; i++) {
            try {
                const operation = i % 4; // Cycle through CRUD operations
                const requestStart = performance.now();

                switch (operation) {
                    case 0: // CREATE
                        const createResponse = await this.createRide(`worker-${workerId}-${i}`);
                        if (createResponse && createResponse.data) {
                            createdRides.push(createResponse.data._id);
                            results.creates++;
                        }
                        break;

                    case 1: // READ
                        await this.makeRequest('/api/rides', 'GET');
                        results.reads++;
                        break;

                    case 2: // UPDATE
                        if (createdRides.length > 0) {
                            const rideId = createdRides[Math.floor(Math.random() * createdRides.length)];
                            await this.updateRide(rideId);
                            results.updates++;
                        } else {
                            results.reads++; // Fallback to read if no rides to update
                            await this.makeRequest('/api/rides', 'GET');
                        }
                        break;

                    case 3: // DELETE
                        if (createdRides.length > 0) {
                            const rideId = createdRides.pop();
                            await this.deleteRide(rideId);
                            results.deletes++;
                        } else {
                            results.reads++; // Fallback to read if no rides to delete
                            await this.makeRequest('/api/rides', 'GET');
                        }
                        break;
                }

                const responseTime = performance.now() - requestStart;
                results.responseTimes.push(responseTime);
                this.responseTimes.push(responseTime);

            } catch (error) {
                results.errors++;
            }

            // Small delay between operations
            await this.sleep(10 + Math.random() * 20);
        }
    }

    /**
     * Test memory usage patterns
     */
    async runMemoryTest(iterations = 1000) {
        console.log(`\n🧠 Starting memory test: ${iterations} iterations`);
        
        const startMemory = process.memoryUsage();
        const startTime = performance.now();
        const memorySnapshots = [];

        for (let i = 0; i < iterations; i++) {
            try {
                // Create memory pressure through API calls
                await Promise.all([
                    this.makeRequest('/api/rides', 'GET'),
                    this.searchRides(),
                    this.makeRequest('/health', 'GET')
                ]);

                // Take memory snapshot every 100 iterations
                if (i % 100 === 0) {
                    const currentMemory = process.memoryUsage();
                    memorySnapshots.push({
                        iteration: i,
                        memory: currentMemory,
                        heapUsed: currentMemory.heapUsed / 1024 / 1024 // MB
                    });
                }

            } catch (error) {
                // Continue on errors
            }
        }

        const endMemory = process.memoryUsage();
        const duration = (performance.now() - startTime) / 1000;

        console.log(`✅ Memory test completed:`);
        console.log(`   Duration: ${duration.toFixed(2)}s`);
        console.log(`   Start heap: ${(startMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   End heap: ${(endMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Peak heap: ${Math.max(...memorySnapshots.map(s => s.heapUsed)).toFixed(2)} MB`);

        return {
            scenario: 'memory-test',
            duration,
            iterations,
            startMemory: startMemory.heapUsed / 1024 / 1024,
            endMemory: endMemory.heapUsed / 1024 / 1024,
            peakMemory: Math.max(...memorySnapshots.map(s => s.heapUsed)),
            snapshots: memorySnapshots
        };
    }

    /**
     * Helper methods
     */
    async makeRequest(path, method = 'GET', data = null) {
        const config = {
            method,
            url: `${this.baseUrl}${path}`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            config.data = data;
        }

        const response = await axios(config);
        return response.data;
    }

    async searchRides() {
        const searchTerms = ['palace', 'metro', 'mall', 'office', 'home'];
        const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        return this.makeRequest(`/api/search?from=${term}`, 'GET');
    }

    async createRide(identifier) {
        const data = {
            pickupLocation: `Test Location ${identifier}`,
            dropoffLocation: `Destination ${identifier}`,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            time: '09:00',
            totalSeats: Math.floor(Math.random() * 4) + 1,
            fare: Math.floor(Math.random() * 100) + 20,
            driverName: `Driver ${identifier}`,
            driverContact: `987654${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
        };

        return this.makeRequest('/api/rides', 'POST', data);
    }

    async updateRide(rideId) {
        const data = {
            fare: Math.floor(Math.random() * 100) + 20,
            totalSeats: Math.floor(Math.random() * 4) + 1
        };

        return this.makeRequest(`/api/rides/${rideId}`, 'PUT', data);
    }

    async deleteRide(rideId) {
        return this.makeRequest(`/api/rides/${rideId}`, 'DELETE');
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Calculate statistics
     */
    calculateStats(responseTimes) {
        if (responseTimes.length === 0) return null;

        const sorted = [...responseTimes].sort((a, b) => a - b);
        const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        const min = Math.min(...responseTimes);
        const max = Math.max(...responseTimes);
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];

        return { avg, min, max, p50, p95, p99 };
    }

    /**
     * Run all load tests
     */
    async runFullSuite() {
        console.log('🚀 Starting comprehensive load testing suite...\n');
        
        const overallStart = performance.now();
        
        try {
            // 1. Concurrency Test
            const concurrencyResult = await this.runConcurrencyTest(30, 30);
            this.results.scenarios.push(concurrencyResult);

            // Cool down period
            console.log('\n⏸️ Cool down period (10s)...');
            await this.sleep(10000);

            // 2. API Load Test
            const apiResult = await this.runAPILoadTest(50, 20);
            this.results.scenarios.push(apiResult);

            // Cool down period
            console.log('\n⏸️ Cool down period (10s)...');
            await this.sleep(10000);

            // 3. Database Load Test
            const dbResult = await this.runDatabaseLoadTest(15, 500);
            this.results.scenarios.push(dbResult);

            // Cool down period
            console.log('\n⏸️ Cool down period (5s)...');
            await this.sleep(5000);

            // 4. Memory Test
            const memoryResult = await this.runMemoryTest(200);
            this.results.scenarios.push(memoryResult);

        } catch (error) {
            console.error('❌ Load test error:', error.message);
        }

        const overallDuration = (performance.now() - overallStart) / 1000;
        
        // Calculate overall statistics
        const allResponseTimes = this.responseTimes;
        const stats = this.calculateStats(allResponseTimes);
        
        this.results.summary = {
            totalRequests: this.results.scenarios.reduce((sum, s) => sum + (s.requests || s.operations || 0), 0),
            totalErrors: this.results.scenarios.reduce((sum, s) => sum + s.errors, 0),
            duration: overallDuration,
            ...stats
        };

        this.generateReport();
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 LOAD TESTING REPORT');
        console.log('='.repeat(80));

        // Overall summary
        console.log('\n📈 OVERALL SUMMARY:');
        console.log(`   Total Duration: ${this.results.summary.duration.toFixed(2)}s`);
        console.log(`   Total Requests/Operations: ${this.results.summary.totalRequests}`);
        console.log(`   Total Errors: ${this.results.summary.totalErrors}`);
        console.log(`   Overall Error Rate: ${((this.results.summary.totalErrors / this.results.summary.totalRequests) * 100).toFixed(2)}%`);
        
        if (this.results.summary.avg) {
            console.log(`   Average Response Time: ${this.results.summary.avg.toFixed(2)}ms`);
            console.log(`   95th Percentile: ${this.results.summary.p95.toFixed(2)}ms`);
            console.log(`   99th Percentile: ${this.results.summary.p99.toFixed(2)}ms`);
        }

        // Individual scenario results
        console.log('\n🎯 SCENARIO RESULTS:');
        this.results.scenarios.forEach((scenario, index) => {
            console.log(`\n${index + 1}. ${scenario.scenario.toUpperCase()}`);
            console.log(`   Duration: ${scenario.duration.toFixed(2)}s`);
            
            if (scenario.requests) {
                console.log(`   Requests: ${scenario.requests}`);
                console.log(`   RPS: ${(scenario.rps || scenario.actualRps || 0).toFixed(2)}`);
            }
            
            if (scenario.operations) {
                console.log(`   Operations: ${scenario.operations}`);
                console.log(`   Ops/sec: ${scenario.opsPerSecond.toFixed(2)}`);
            }
            
            console.log(`   Errors: ${scenario.errors}`);
            console.log(`   Error Rate: ${((scenario.errors / (scenario.requests || scenario.operations || 1)) * 100).toFixed(2)}%`);
            
            if (scenario.breakdown) {
                console.log(`   Breakdown: C:${scenario.breakdown.creates} R:${scenario.breakdown.reads} U:${scenario.breakdown.updates} D:${scenario.breakdown.deletes}`);
            }
            
            if (scenario.startMemory !== undefined) {
                console.log(`   Memory: ${scenario.startMemory.toFixed(2)} → ${scenario.endMemory.toFixed(2)} MB (Peak: ${scenario.peakMemory.toFixed(2)} MB)`);
            }
        });

        // Performance recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        this.generateRecommendations();

        console.log('\n' + '='.repeat(80));
        console.log('✅ Load testing completed successfully!');
        console.log('='.repeat(80));
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations() {
        const summary = this.results.summary;
        const errorRate = (summary.totalErrors / summary.totalRequests) * 100;

        if (errorRate > 5) {
            console.log('   ⚠️ High error rate detected. Consider:');
            console.log('     • Implementing circuit breakers');
            console.log('     • Adding request queuing');
            console.log('     • Scaling database connections');
        }

        if (summary.p95 && summary.p95 > 1000) {
            console.log('   🐌 Slow response times detected. Consider:');
            console.log('     • Adding Redis caching');
            console.log('     • Optimizing database queries');
            console.log('     • Implementing CDN for static assets');
        }

        if (summary.avg && summary.avg > 500) {
            console.log('   ⏱️ Above-average response times. Consider:');
            console.log('     • Database indexing optimization');
            console.log('     • API endpoint caching');
            console.log('     • Connection pooling tuning');
        }

        const memoryScenario = this.results.scenarios.find(s => s.scenario === 'memory-test');
        if (memoryScenario && memoryScenario.peakMemory > 200) {
            console.log('   🧠 High memory usage detected. Consider:');
            console.log('     • Implementing garbage collection tuning');
            console.log('     • Adding memory monitoring alerts');
            console.log('     • Reviewing for memory leaks');
        }

        console.log('   ✅ For optimal performance:');
        console.log('     • Target < 200ms p95 response time');
        console.log('     • Maintain < 1% error rate');
        console.log('     • Monitor memory growth patterns');
        console.log('     • Implement comprehensive caching strategy');
    }
}

// CLI execution
if (require.main === module) {
    const baseUrl = process.argv[2] || 'http://localhost:3000';
    
    console.log(`🎯 Load testing target: ${baseUrl}`);
    console.log('📋 Test plan: Concurrency → API Load → Database Load → Memory Test\n');
    
    const tester = new LoadTester(baseUrl);
    
    tester.runFullSuite().catch(error => {
        console.error('❌ Load testing failed:', error);
        process.exit(1);
    });
}

module.exports = LoadTester;
