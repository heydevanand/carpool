#!/usr/bin/env node

/**
 * Database Optimization Script
 * Creates indexes and optimizes database performance
 */

const mongoose = require('mongoose');
const DatabaseOptimizer = require('../middleware/database-optimizer');
const logger = require('../middleware/logger');

// Load environment variables
require('dotenv').config();

async function optimizeDatabase() {
    console.log('🚀 Starting database optimization...\n');
    
    try {
        // Connect to database
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpool';
        console.log(`📡 Connecting to database: ${mongoUri}`);
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Database connected successfully\n');
        
        // Load models
        require('../models/Ride');
        require('../models/Location');
        require('../models/Admin');
        
        // Initialize optimizer
        const optimizer = new DatabaseOptimizer();
        
        // Run optimization
        const report = await optimizer.optimize();
        
        // Display results
        console.log('\n' + '='.repeat(80));
        console.log('📊 DATABASE OPTIMIZATION REPORT');
        console.log('='.repeat(80));
        
        console.log('\n🏗️ INDEXING RESULTS:');
        console.log(`   Created: ${report.indexing.total_created} indexes`);
        console.log(`   Failed: ${report.indexing.total_failed} indexes`);
        
        if (report.indexing.created.length > 0) {
            console.log('\n✅ Successfully created indexes:');
            report.indexing.created.forEach(index => {
                console.log(`     • ${index}`);
            });
        }
        
        if (report.indexing.failed.length > 0) {
            console.log('\n❌ Failed to create indexes:');
            report.indexing.failed.forEach(index => {
                console.log(`     • ${index}`);
            });
        }
        
        console.log('\n📈 QUERY ANALYSIS:');
        console.log(`   Queries analyzed: ${report.query_analysis.queries_analyzed}`);
        console.log(`   Slow queries: ${report.query_analysis.slow_queries.length}`);
        console.log(`   Inefficient queries: ${report.query_analysis.inefficient_queries.length}`);
        
        if (report.query_analysis.slow_queries.length > 0) {
            console.log('\n🐌 Slow queries detected:');
            report.query_analysis.slow_queries.forEach(query => {
                console.log(`     • ${query.queryName}: ${query.executionTimeMs}ms`);
            });
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        if (report.recommendations.length > 0) {
            report.recommendations.forEach(rec => {
                const priority = rec.priority.toUpperCase();
                const icon = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
                console.log(`   ${icon} [${priority}] ${rec.message}`);
                if (rec.details && Array.isArray(rec.details)) {
                    rec.details.forEach(detail => {
                        console.log(`     - ${detail}`);
                    });
                }
            });
        } else {
            console.log('   ✅ No immediate optimization recommendations');
        }
        
        // Get database stats
        const stats = await optimizer.getDatabaseStats();
        
        console.log('\n📊 DATABASE STATISTICS:');
        console.log(`   Database: ${stats.database.name}`);
        console.log(`   Collections: ${stats.database.collections}`);
        console.log(`   Total documents: ${stats.database.documents}`);
        console.log(`   Data size: ${(stats.database.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Storage size: ${(stats.database.storageSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Index size: ${(stats.database.indexSize / 1024 / 1024).toFixed(2)} MB`);
        
        console.log('\n🗃️ COLLECTION DETAILS:');
        Object.entries(stats.collections).forEach(([name, collStats]) => {
            if (!collStats.error) {
                console.log(`   ${name}:`);
                console.log(`     Documents: ${collStats.documents}`);
                console.log(`     Indexes: ${collStats.indexes}`);
                console.log(`     Storage: ${(collStats.storageSize / 1024).toFixed(2)} KB`);
                console.log(`     Index size: ${(collStats.totalIndexSize / 1024).toFixed(2)} KB`);
            }
        });
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ Database optimization completed successfully!');
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('\n❌ Database optimization failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Database connection closed');
    }
}

// Run optimization if called directly
if (require.main === module) {
    optimizeDatabase().catch(console.error);
}

module.exports = optimizeDatabase;
