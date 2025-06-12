const mongoose = require('mongoose');
const Location = require('./models/Location');

const MONGODB_URI = 'mongodb+srv://heydevanand:engineerdev@dev-cluster.okxr9gy.mongodb.net/pg-carpool?retryWrites=true&w=majority&appName=Dev-Cluster';

async function setupPGOfficeLocations() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Define the required locations
        const requiredLocations = [
            { name: 'Nayi PG', type: 'pg' },
            { name: 'Puraani PG', type: 'pg' },
            { name: 'Main Office', type: 'office' },
            { name: 'Branch Office', type: 'office' },
            { name: 'Corporate Office', type: 'office' }
        ];

        console.log('🏢 Setting up PG and Office locations...');

        for (const locationData of requiredLocations) {
            const existingLocation = await Location.findOne({ name: locationData.name });
            
            if (!existingLocation) {
                const newLocation = new Location(locationData);
                await newLocation.save();
                console.log(`✅ Created: ${locationData.name} (${locationData.type})`);
            } else {
                console.log(`⏭️  Already exists: ${locationData.name}`);
            }
        }

        // List all current locations
        const allLocations = await Location.find().sort({ name: 1 });
        console.log('\n📍 Current Locations:');
        allLocations.forEach(location => {
            const type = location.name.toLowerCase().includes('pg') ? '🏠 PG' : '🏢 Office';
            console.log(`${type} - ${location.name} (ID: ${location._id})`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Setup completed');
        process.exit(0);
    }
}

setupPGOfficeLocations();
