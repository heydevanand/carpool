/**
 * Database Optimization Module
 * Handles indexing, query optimization, and database performance
 */

const mongoose = require('mongoose');
const logger = require('./logger');

class DatabaseOptimizer {
    constructor() {
        this.indexingStatus = {
            created: [],
            failed: [],
            analyzed: []
        };
    }

    /**
     * Create optimized indexes for all collections
     */
    async createOptimizedIndexes() {
        logger.info('🗄️ Starting database optimization...');
        
        try {
            await this.createRideIndexes();
            await this.createLocationIndexes();
            await this.createAdminIndexes();
            await this.createUserSessionIndexes();
            
            logger.info('✅ Database optimization completed', {
                created: this.indexingStatus.created.length,
                failed: this.indexingStatus.failed.length
            });
            
            return this.indexingStatus;
        } catch (error) {
            logger.error('❌ Database optimization failed:', error);
            throw error;
        }
    }

    /**
     * Create indexes for Ride collection
     */
    async createRideIndexes() {
        const Ride = mongoose.model('Ride');
        
        const indexes = [
            // Compound index for location-based searches
            {
                keys: { pickupLocation: 'text', dropoffLocation: 'text' },
                options: { 
                    name: 'location_search',
                    weights: { pickupLocation: 2, dropoffLocation: 1 }
                }
            },
            
            // Date and time searches
            {
                keys: { date: 1, time: 1 },
                options: { name: 'datetime_search' }
            },
            
            // Status-based queries
            {
                keys: { status: 1, date: 1 },
                options: { name: 'status_date' }
            },
            
            // Available seats for booking queries
            {
                keys: { availableSeats: 1, status: 1, date: 1 },
                options: { name: 'available_rides' }
            },
            
            // Driver-based queries
            {
                keys: { driverContact: 1, status: 1 },
                options: { name: 'driver_rides' }
            },
            
            // Fare range searches
            {
                keys: { fare: 1, date: 1 },
                options: { name: 'fare_search' }
            },
            
            // Created time for cleanup operations
            {
                keys: { createdAt: 1 },
                options: { name: 'created_time' }
            },
            
            // Updated time for archival
            {
                keys: { updatedAt: 1, status: 1 },
                options: { name: 'updated_status' }
            },
            
            // Passenger searches (sparse index for efficiency)
            {
                keys: { 'passengers.contact': 1 },
                options: { 
                    name: 'passenger_contact',
                    sparse: true
                }
            },
            
            // Geospatial index for location-based searches (if implementing geo features)
            {
                keys: { 'pickup_coordinates': '2dsphere' },
                options: { 
                    name: 'pickup_geo',
                    sparse: true
                }
            }
        ];

        await this.createIndexesForCollection(Ride, indexes, 'Ride');
    }

    /**
     * Create indexes for Location collection
     */
    async createLocationIndexes() {
        const Location = mongoose.model('Location');
        
        const indexes = [
            // Text search for location names
            {
                keys: { name: 'text', address: 'text' },
                options: { 
                    name: 'location_text_search',
                    weights: { name: 3, address: 1 }
                }
            },
            
            // Type-based queries
            {
                keys: { type: 1, isActive: 1 },
                options: { name: 'type_active' }
            },
            
            // Popular locations
            {
                keys: { usageCount: -1, isActive: 1 },
                options: { name: 'popular_locations' }
            },
            
            // Geospatial index for coordinates
            {
                keys: { coordinates: '2dsphere' },
                options: { 
                    name: 'location_geo',
                    sparse: true
                }
            }
        ];

        await this.createIndexesForCollection(Location, indexes, 'Location');
    }

    /**
     * Create indexes for Admin collection
     */
    async createAdminIndexes() {
        const Admin = mongoose.model('Admin');
        
        const indexes = [
            // Username uniqueness and login
            {
                keys: { username: 1 },
                options: { 
                    name: 'username_unique',
                    unique: true
                }
            },
            
            // Email index (if implemented)
            {
                keys: { email: 1 },
                options: { 
                    name: 'email_index',
                    sparse: true,
                    unique: true
                }
            },
            
            // Last login tracking
            {
                keys: { lastLogin: -1 },
                options: { name: 'last_login' }
            }
        ];

        await this.createIndexesForCollection(Admin, indexes, 'Admin');
    }

    /**
     * Create indexes for user sessions (if storing in MongoDB)
     */
    async createUserSessionIndexes() {
        try {
            const db = mongoose.connection.db;
            const sessionCollection = db.collection('sessions');
            
            const indexes = [
                // Session expiry (TTL index)
                {
                    keys: { expires: 1 },
                    options: { 
                        name: 'session_ttl',
                        expireAfterSeconds: 0
                    }
                },
                
                // Session ID lookup
                {
                    keys: { _id: 1 },
                    options: { name: 'session_id' }
                }
            ];

            for (const index of indexes) {
                try {
                    await sessionCollection.createIndex(index.keys, index.options);
                    this.indexingStatus.created.push(`sessions.${index.options.name}`);
                    logger.info(`✅ Created index: sessions.${index.options.name}`);
                } catch (error) {
                    if (error.code === 11000 || error.code === 85) {
                        // Index already exists
                        logger.info(`ℹ️ Index already exists: sessions.${index.options.name}`);
                    } else {
                        this.indexingStatus.failed.push(`sessions.${index.options.name}: ${error.message}`);
                        logger.warn(`⚠️ Failed to create index sessions.${index.options.name}:`, error.message);
                    }
                }
            }
        } catch (error) {
            logger.warn('⚠️ Could not create session indexes (collection may not exist):', error.message);
        }
    }

    /**
     * Helper method to create indexes for a collection
     */
    async createIndexesForCollection(Model, indexes, collectionName) {
        for (const index of indexes) {
            try {
                await Model.collection.createIndex(index.keys, index.options);
                this.indexingStatus.created.push(`${collectionName}.${index.options.name}`);
                logger.info(`✅ Created index: ${collectionName}.${index.options.name}`);
            } catch (error) {
                if (error.code === 11000 || error.code === 85) {
                    // Index already exists
                    logger.info(`ℹ️ Index already exists: ${collectionName}.${index.options.name}`);
                } else {
                    this.indexingStatus.failed.push(`${collectionName}.${index.options.name}: ${error.message}`);
                    logger.warn(`⚠️ Failed to create index ${collectionName}.${index.options.name}:`, error.message);
                }
            }
        }
    }

    /**
     * Analyze query performance
     */
    async analyzeQueryPerformance() {
        logger.info('📊 Analyzing query performance...');
        
        const analyses = [];
        
        try {
            // Analyze common ride queries
            const rideAnalyses = await this.analyzeRideQueries();
            analyses.push(...rideAnalyses);
            
            // Analyze location queries
            const locationAnalyses = await this.analyzeLocationQueries();
            analyses.push(...locationAnalyses);
            
            this.indexingStatus.analyzed = analyses;
            
            logger.info('✅ Query performance analysis completed', {
                queries_analyzed: analyses.length
            });
            
            return analyses;
        } catch (error) {
            logger.error('❌ Query performance analysis failed:', error);
            throw error;
        }
    }

    /**
     * Analyze ride collection queries
     */
    async analyzeRideQueries() {
        const Ride = mongoose.model('Ride');
        const analyses = [];
        
        const testQueries = [
            {
                name: 'Available rides by date',
                query: { 
                    status: 'active', 
                    date: { $gte: new Date().toISOString().split('T')[0] },
                    availableSeats: { $gt: 0 }
                }
            },
            {
                name: 'Location text search',
                query: { $text: { $search: 'palace metro' } }
            },
            {
                name: 'Rides by fare range',
                query: { 
                    fare: { $gte: 20, $lte: 100 },
                    status: 'active',
                    date: { $gte: new Date().toISOString().split('T')[0] }
                }
            },
            {
                name: 'Driver rides',
                query: { 
                    driverContact: '9876543210',
                    status: { $in: ['active', 'completed'] }
                }
            }
        ];

        for (const testQuery of testQueries) {
            try {
                const explanation = await Ride.find(testQuery.query).explain('executionStats');
                
                const stats = explanation.executionStats;
                const analysis = {
                    collection: 'Ride',
                    queryName: testQuery.name,
                    query: testQuery.query,
                    executionTimeMs: stats.executionTimeMillis,
                    totalDocsExamined: stats.totalDocsExamined,
                    totalDocsReturned: stats.totalDocsReturned,
                    indexUsed: stats.stage === 'IXSCAN',
                    winningPlan: stats.winningPlan,
                    efficiency: stats.totalDocsReturned / (stats.totalDocsExamined || 1)
                };
                
                analyses.push(analysis);
                
                logger.info(`📊 Query analysis: ${testQuery.name}`, {
                    executionTime: `${stats.executionTimeMillis}ms`,
                    docsExamined: stats.totalDocsExamined,
                    docsReturned: stats.totalDocsReturned,
                    efficiency: (analysis.efficiency * 100).toFixed(2) + '%'
                });
                
            } catch (error) {
                logger.warn(`⚠️ Could not analyze query: ${testQuery.name}`, error.message);
            }
        }
        
        return analyses;
    }

    /**
     * Analyze location collection queries
     */
    async analyzeLocationQueries() {
        const Location = mongoose.model('Location');
        const analyses = [];
        
        const testQueries = [
            {
                name: 'Active locations by type',
                query: { type: 'metro', isActive: true }
            },
            {
                name: 'Location text search',
                query: { $text: { $search: 'palace' } }
            },
            {
                name: 'Popular locations',
                query: { isActive: true },
                sort: { usageCount: -1 }
            }
        ];

        for (const testQuery of testQueries) {
            try {
                let query = Location.find(testQuery.query);
                if (testQuery.sort) {
                    query = query.sort(testQuery.sort);
                }
                
                const explanation = await query.explain('executionStats');
                
                const stats = explanation.executionStats;
                const analysis = {
                    collection: 'Location',
                    queryName: testQuery.name,
                    query: testQuery.query,
                    sort: testQuery.sort || null,
                    executionTimeMs: stats.executionTimeMillis,
                    totalDocsExamined: stats.totalDocsExamined,
                    totalDocsReturned: stats.totalDocsReturned,
                    indexUsed: stats.stage === 'IXSCAN',
                    efficiency: stats.totalDocsReturned / (stats.totalDocsExamined || 1)
                };
                
                analyses.push(analysis);
                
                logger.info(`📊 Query analysis: ${testQuery.name}`, {
                    executionTime: `${stats.executionTimeMillis}ms`,
                    docsExamined: stats.totalDocsExamined,
                    docsReturned: stats.totalDocsReturned,
                    efficiency: (analysis.efficiency * 100).toFixed(2) + '%'
                });
                
            } catch (error) {
                logger.warn(`⚠️ Could not analyze query: ${testQuery.name}`, error.message);
            }
        }
        
        return analyses;
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        try {
            const db = mongoose.connection.db;
            const stats = await db.stats();
            
            const collections = await db.listCollections().toArray();
            const collectionStats = {};
            
            for (const collection of collections) {
                try {
                    const collStats = await db.collection(collection.name).stats();
                    collectionStats[collection.name] = {
                        documents: collStats.count,
                        avgObjSize: collStats.avgObjSize,
                        storageSize: collStats.storageSize,
                        totalIndexSize: collStats.totalIndexSize,
                        indexes: collStats.nindexes
                    };
                } catch (error) {
                    // Some collections might not support stats
                    collectionStats[collection.name] = { error: error.message };
                }
            }
            
            return {
                database: {
                    name: stats.db,
                    collections: stats.collections,
                    documents: stats.objects,
                    avgObjSize: stats.avgObjSize,
                    dataSize: stats.dataSize,
                    storageSize: stats.storageSize,
                    indexSize: stats.indexSize
                },
                collections: collectionStats
            };
        } catch (error) {
            logger.error('❌ Failed to get database stats:', error);
            throw error;
        }
    }

    /**
     * Optimize collection settings
     */
    async optimizeCollections() {
        logger.info('⚙️ Optimizing collection settings...');
        
        try {
            // Enable profiling for slow operations
            await this.enableProfiling();
            
            // Set read preferences for better performance
            await this.configureReadPreferences();
            
            logger.info('✅ Collection optimization completed');
        } catch (error) {
            logger.error('❌ Collection optimization failed:', error);
            throw error;
        }
    }

    /**
     * Enable database profiling for slow operations
     */
    async enableProfiling() {
        try {
            const db = mongoose.connection.db;
            
            // Enable profiling for operations slower than 100ms
            await db.admin().command({
                profile: 2,
                slowms: 100,
                sampleRate: 0.5 // Sample 50% of operations
            });
            
            logger.info('✅ Database profiling enabled (slowms: 100)');
        } catch (error) {
            logger.warn('⚠️ Could not enable database profiling:', error.message);
        }
    }

    /**
     * Configure read preferences for better performance
     */
    async configureReadPreferences() {
        try {
            // Set read preference to secondary preferred for read-heavy operations
            mongoose.set('readPreference', 'secondaryPreferred');
            
            // Configure connection pooling
            mongoose.set('maxPoolSize', 20);
            mongoose.set('minPoolSize', 5);
            mongoose.set('maxIdleTimeMS', 30000);
            
            logger.info('✅ Read preferences configured');
        } catch (error) {
            logger.warn('⚠️ Could not configure read preferences:', error.message);
        }
    }

    /**
     * Generate optimization report
     */
    generateOptimizationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            indexing: {
                created: this.indexingStatus.created,
                failed: this.indexingStatus.failed,
                total_created: this.indexingStatus.created.length,
                total_failed: this.indexingStatus.failed.length
            },
            query_analysis: {
                queries_analyzed: this.indexingStatus.analyzed.length,
                slow_queries: this.indexingStatus.analyzed.filter(q => q.executionTimeMs > 100),
                inefficient_queries: this.indexingStatus.analyzed.filter(q => q.efficiency < 0.5)
            },
            recommendations: this.generateRecommendations()
        };

        logger.info('📋 Database optimization report generated', {
            indexes_created: report.indexing.total_created,
            indexes_failed: report.indexing.total_failed,
            queries_analyzed: report.query_analysis.queries_analyzed
        });

        return report;
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Index recommendations
        if (this.indexingStatus.failed.length > 0) {
            recommendations.push({
                type: 'indexing',
                priority: 'high',
                message: `${this.indexingStatus.failed.length} indexes failed to create. Review and resolve conflicts.`,
                details: this.indexingStatus.failed
            });
        }
        
        // Query performance recommendations
        const slowQueries = this.indexingStatus.analyzed.filter(q => q.executionTimeMs > 100);
        if (slowQueries.length > 0) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                message: `${slowQueries.length} slow queries detected (>100ms). Consider query optimization.`,
                details: slowQueries.map(q => q.queryName)
            });
        }
        
        // Efficiency recommendations
        const inefficientQueries = this.indexingStatus.analyzed.filter(q => q.efficiency < 0.5);
        if (inefficientQueries.length > 0) {
            recommendations.push({
                type: 'efficiency',
                priority: 'medium',
                message: `${inefficientQueries.length} inefficient queries detected (<50% efficiency). Review indexes.`,
                details: inefficientQueries.map(q => q.queryName)
            });
        }
        
        // General recommendations
        recommendations.push({
            type: 'general',
            priority: 'low',
            message: 'Consider implementing query result caching for frequently accessed data.',
            details: ['Redis caching for ride searches', 'In-memory caching for location data']
        });
        
        return recommendations;
    }

    /**
     * Run complete database optimization
     */
    async optimize() {
        logger.info('🚀 Starting complete database optimization...');
        
        try {
            // 1. Create indexes
            await this.createOptimizedIndexes();
            
            // 2. Analyze queries
            await this.analyzeQueryPerformance();
            
            // 3. Optimize collections
            await this.optimizeCollections();
            
            // 4. Generate report
            const report = this.generateOptimizationReport();
            
            logger.info('✅ Database optimization completed successfully');
            
            return report;
        } catch (error) {
            logger.error('❌ Database optimization failed:', error);
            throw error;
        }
    }
}

module.exports = DatabaseOptimizer;
