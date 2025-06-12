/**
 * Redis Caching Layer
 * High-performance caching system with intelligent cache management
 */

const redis = require('redis');
const logger = require('./logger');
const { config } = require('../config/environment');

class CacheManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.cacheStats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
        this.defaultTTL = config.performance?.cache?.ttl || 300; // 5 minutes default
    }

    /**
     * Initialize Redis connection
     */
    async initialize() {
        try {
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                db: process.env.REDIS_DB || 0,
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                lazyConnect: true
            };

            // Add auth if password is provided
            if (redisConfig.password) {
                redisConfig.password = redisConfig.password;
            }

            this.client = redis.createClient(redisConfig);

            // Event handlers
            this.client.on('connect', () => {
                logger.info('🔗 Redis connecting...');
            });

            this.client.on('ready', () => {
                this.isConnected = true;
                logger.info('✅ Redis connected and ready');
            });

            this.client.on('error', (error) => {
                this.isConnected = false;
                this.cacheStats.errors++;
                logger.error('❌ Redis error:', error);
            });

            this.client.on('end', () => {
                this.isConnected = false;
                logger.warn('⚠️ Redis connection ended');
            });

            this.client.on('reconnecting', () => {
                logger.info('🔄 Redis reconnecting...');
            });

            await this.client.connect();
            
            // Test connection
            await this.client.ping();
            
            logger.info('🚀 Cache system initialized successfully');
            
        } catch (error) {
            this.isConnected = false;
            logger.warn('⚠️ Redis not available, running without cache:', error.message);
            
            // Create mock client for graceful degradation
            this.createMockClient();
        }
    }

    /**
     * Create mock client for when Redis is unavailable
     */
    createMockClient() {
        this.client = {
            get: async () => null,
            set: async () => 'OK',
            del: async () => 1,
            exists: async () => 0,
            expire: async () => 1,
            flushdb: async () => 'OK',
            keys: async () => [],
            mget: async () => [],
            mset: async () => 'OK',
            ping: async () => 'PONG'
        };
        logger.info('🎭 Running with mock cache client');
    }

    /**
     * Get value from cache
     */
    async get(key) {
        if (!this.isConnected && this.client.ping) {
            // Try to reconnect
            try {
                await this.client.ping();
                this.isConnected = true;
            } catch (error) {
                // Still not connected, return null
                this.cacheStats.misses++;
                return null;
            }
        }

        try {
            const value = await this.client.get(this.formatKey(key));
            
            if (value !== null) {
                this.cacheStats.hits++;
                try {
                    return JSON.parse(value);
                } catch (error) {
                    // Return raw value if not JSON
                    return value;
                }
            } else {
                this.cacheStats.misses++;
                return null;
            }
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache GET error:', error);
            return null;
        }
    }

    /**
     * Set value in cache
     */
    async set(key, value, ttl = null) {
        if (!this.isConnected) return false;

        try {
            const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
            const cacheKey = this.formatKey(key);
            const expiry = ttl || this.defaultTTL;

            await this.client.setEx(cacheKey, expiry, serializedValue);
            this.cacheStats.sets++;
            
            return true;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache SET error:', error);
            return false;
        }
    }

    /**
     * Delete value from cache
     */
    async del(key) {
        if (!this.isConnected) return false;

        try {
            const result = await this.client.del(this.formatKey(key));
            this.cacheStats.deletes++;
            return result > 0;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache DELETE error:', error);
            return false;
        }
    }

    /**
     * Check if key exists
     */
    async exists(key) {
        if (!this.isConnected) return false;

        try {
            const result = await this.client.exists(this.formatKey(key));
            return result === 1;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache EXISTS error:', error);
            return false;
        }
    }

    /**
     * Set expiry for existing key
     */
    async expire(key, ttl) {
        if (!this.isConnected) return false;

        try {
            const result = await this.client.expire(this.formatKey(key), ttl);
            return result === 1;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache EXPIRE error:', error);
            return false;
        }
    }

    /**
     * Get multiple values
     */
    async mget(keys) {
        if (!this.isConnected) return keys.map(() => null);

        try {
            const formattedKeys = keys.map(key => this.formatKey(key));
            const values = await this.client.mGet(formattedKeys);
            
            return values.map(value => {
                if (value !== null) {
                    this.cacheStats.hits++;
                    try {
                        return JSON.parse(value);
                    } catch (error) {
                        return value;
                    }
                } else {
                    this.cacheStats.misses++;
                    return null;
                }
            });
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache MGET error:', error);
            return keys.map(() => null);
        }
    }

    /**
     * Set multiple values
     */
    async mset(keyValuePairs, ttl = null) {
        if (!this.isConnected) return false;

        try {
            const pairs = [];
            for (const [key, value] of Object.entries(keyValuePairs)) {
                pairs.push(this.formatKey(key));
                pairs.push(typeof value === 'string' ? value : JSON.stringify(value));
            }

            await this.client.mSet(pairs);
            
            // Set expiry for each key if TTL is specified
            if (ttl) {
                const expirePromises = Object.keys(keyValuePairs).map(key =>
                    this.client.expire(this.formatKey(key), ttl)
                );
                await Promise.all(expirePromises);
            }

            this.cacheStats.sets += Object.keys(keyValuePairs).length;
            return true;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache MSET error:', error);
            return false;
        }
    }

    /**
     * Clear all cache
     */
    async clear() {
        if (!this.isConnected) return false;

        try {
            await this.client.flushDb();
            logger.info('🧹 Cache cleared');
            return true;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache CLEAR error:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0 ?
            (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2) : 0;

        return {
            ...this.cacheStats,
            hitRate: `${hitRate}%`,
            isConnected: this.isConnected
        };
    }

    /**
     * Format cache key with prefix
     */
    formatKey(key) {
        const prefix = process.env.CACHE_PREFIX || 'carpool';
        return `${prefix}:${key}`;
    }

    /**
     * Cache warming - preload frequently accessed data
     */
    async warmCache() {
        if (!this.isConnected) return;

        logger.info('🔥 Warming cache...');

        try {
            // Warm common queries (this would be called from the application)
            await this.warmRideSearches();
            await this.warmLocationData();
            
            logger.info('✅ Cache warmed successfully');
        } catch (error) {
            logger.error('❌ Cache warming failed:', error);
        }
    }

    /**
     * Warm ride search cache
     */
    async warmRideSearches() {
        // This would typically be called with actual data from the database
        const commonSearches = [
            'active_rides',
            'today_rides',
            'popular_routes'
        ];

        // Pre-cache empty results for now (would be replaced with real data)
        for (const search of commonSearches) {
            await this.set(`rides:${search}`, [], 300); // 5 minutes TTL
        }
    }

    /**
     * Warm location data cache
     */
    async warmLocationData() {
        // Cache frequently accessed location data
        const locationCaches = [
            'active_locations',
            'popular_locations',
            'metro_stations'
        ];

        for (const cache of locationCaches) {
            await this.set(`locations:${cache}`, [], 600); // 10 minutes TTL
        }
    }

    /**
     * Get all cache keys matching pattern
     */
    async getKeys(pattern = '*') {
        if (!this.isConnected) return [];

        try {
            return await this.client.keys(this.formatKey(pattern));
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache KEYS error:', error);
            return [];
        }
    }

    /**
     * Close Redis connection
     */
    async close() {
        if (this.client && this.isConnected) {
            try {
                await this.client.quit();
                this.isConnected = false;
                logger.info('👋 Redis connection closed');
            } catch (error) {
                logger.error('❌ Error closing Redis connection:', error);
            }
        }
    }

    /**
     * Cache middleware for Express routes
     */
    middleware(ttl = null) {
        return async (req, res, next) => {
            // Skip caching for non-GET requests
            if (req.method !== 'GET') {
                return next();
            }

            // Generate cache key from request
            const cacheKey = this.generateRequestKey(req);
            
            try {
                // Try to get cached response
                const cachedResponse = await this.get(cacheKey);
                
                if (cachedResponse) {
                    logger.debug(`Cache HIT: ${cacheKey}`);
                    return res.json(cachedResponse);
                }

                logger.debug(`Cache MISS: ${cacheKey}`);

                // Override res.json to cache the response
                const originalJson = res.json.bind(res);
                res.json = (data) => {
                    // Cache the response
                    this.set(cacheKey, data, ttl || this.defaultTTL).catch(error => {
                        logger.error('❌ Error caching response:', error);
                    });
                    
                    return originalJson(data);
                };

                next();
            } catch (error) {
                logger.error('❌ Cache middleware error:', error);
                next();
            }
        };
    }

    /**
     * Generate cache key from request
     */
    generateRequestKey(req) {
        const baseKey = `${req.method}:${req.path}`;
        const queryString = Object.keys(req.query).length > 0 ? 
            `:${JSON.stringify(req.query)}` : '';
        return `${baseKey}${queryString}`;
    }

    /**
     * Invalidate cache patterns
     */
    async invalidatePattern(pattern) {
        if (!this.isConnected) return 0;

        try {
            const keys = await this.getKeys(pattern);
            if (keys.length > 0) {
                const result = await this.client.del(keys);
                this.cacheStats.deletes += keys.length;
                logger.info(`🗑️ Invalidated ${keys.length} cache entries matching: ${pattern}`);
                return result;
            }
            return 0;
        } catch (error) {
            this.cacheStats.errors++;
            logger.error('❌ Cache invalidation error:', error);
            return 0;
        }
    }

    /**
     * Smart cache invalidation for ride updates
     */
    async invalidateRideCache(rideData = null) {
        const patterns = [
            'rides:*',
            'GET:/api/rides*',
            'GET:/api/search*'
        ];

        // Add specific patterns based on ride data
        if (rideData) {
            if (rideData.pickupLocation) {
                patterns.push(`*${rideData.pickupLocation}*`);
            }
            if (rideData.dropoffLocation) {
                patterns.push(`*${rideData.dropoffLocation}*`);
            }
            if (rideData.date) {
                patterns.push(`*${rideData.date}*`);
            }
        }

        let totalInvalidated = 0;
        for (const pattern of patterns) {
            const count = await this.invalidatePattern(pattern);
            totalInvalidated += count;
        }

        logger.info(`🔄 Invalidated ${totalInvalidated} ride-related cache entries`);
        return totalInvalidated;
    }

    /**
     * Health check for cache system
     */
    async healthCheck() {
        try {
            const start = Date.now();
            await this.client.ping();
            const latency = Date.now() - start;

            return {
                status: 'healthy',
                connected: this.isConnected,
                latency: `${latency}ms`,
                stats: this.getStats()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                connected: false,
                error: error.message,
                stats: this.getStats()
            };
        }
    }
}

// Create singleton instance
const cacheManager = new CacheManager();

// Graceful shutdown
process.on('SIGTERM', async () => {
    await cacheManager.close();
});

process.on('SIGINT', async () => {
    await cacheManager.close();
});

module.exports = cacheManager;
