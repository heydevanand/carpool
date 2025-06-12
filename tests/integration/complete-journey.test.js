const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Ride = require('../../models/Ride');
const Location = require('../../models/Location');
const Admin = require('../../models/Admin');

describe('Integration Tests - Complete User Journeys', () => {
    let server;
    let adminSession;
    let testRideId;
    let testLocationId;

    beforeAll(async () => {
        // Start server
        server = app.listen(0); // Use random port for testing
        
        // Setup test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/carpool_test');
        }
        
        // Clean test data
        await Promise.all([
            Ride.deleteMany({}),
            Location.deleteMany({}),
            Admin.deleteMany({})
        ]);
        
        // Create test admin
        const admin = new Admin({
            username: 'testadmin',
            password: 'testpassword123'
        });
        await admin.save();
        
        // Create test locations
        const locations = await Location.insertMany([
            {
                name: 'JS Palace PG',
                type: 'residence',
                address: 'Sector 48, Gurgaon'
            },
            {
                name: 'Cyber City Metro',
                type: 'metro',
                address: 'Cyber City, Gurgaon'
            },
            {
                name: 'DLF Mall',
                type: 'mall',
                address: 'DLF Phase 1, Gurgaon'
            }
        ]);
        
        testLocationId = locations[0]._id;
    });

    afterAll(async () => {
        // Clean up
        await Promise.all([
            Ride.deleteMany({}),
            Location.deleteMany({}),
            Admin.deleteMany({})
        ]);
        
        if (server) {
            server.close();
        }
        
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    describe('Admin Authentication Flow', () => {
        it('should allow admin login and access protected routes', async () => {
            const agent = request.agent(app);
            
            // Login as admin
            const loginResponse = await agent
                .post('/admin/login')
                .send({
                    username: 'testadmin',
                    password: 'testpassword123'
                })
                .expect(302); // Redirect on successful login
            
            // Access admin dashboard
            const dashboardResponse = await agent
                .get('/admin/dashboard')
                .expect(200);
            
            expect(dashboardResponse.text).toContain('Dashboard');
            
            // Store session for later tests
            adminSession = agent;
        });

        it('should reject invalid admin credentials', async () => {
            await request(app)
                .post('/admin/login')
                .send({
                    username: 'invaliduser',
                    password: 'wrongpassword'
                })
                .expect(302); // Redirect back to login
        });
    });

    describe('Complete Ride Management Journey', () => {
        it('should create, retrieve, update, and delete a ride', async () => {
            // Step 1: Create a new ride
            const rideData = {
                pickupLocation: 'JS Palace PG',
                dropoffLocation: 'Cyber City Metro',
                date: '2024-12-25',
                time: '09:00',
                totalSeats: 4,
                fare: 50,
                driverName: 'John Doe',
                driverContact: '9876543210'
            };

            const createResponse = await request(app)
                .post('/api/rides')
                .send(rideData)
                .expect(201);

            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.data.pickupLocation).toBe(rideData.pickupLocation);
            expect(createResponse.body.data.availableSeats).toBe(4);
            
            testRideId = createResponse.body.data._id;

            // Step 2: Retrieve the created ride
            const getResponse = await request(app)
                .get(`/api/rides/${testRideId}`)
                .expect(200);

            expect(getResponse.body.success).toBe(true);
            expect(getResponse.body.data._id).toBe(testRideId);
            expect(getResponse.body.data.status).toBe('upcoming');

            // Step 3: Update the ride
            const updateData = {
                fare: 60,
                totalSeats: 3,
                driverName: 'Updated Driver'
            };

            const updateResponse = await request(app)
                .put(`/api/rides/${testRideId}`)
                .send(updateData)
                .expect(200);

            expect(updateResponse.body.success).toBe(true);
            expect(updateResponse.body.data.fare).toBe(60);
            expect(updateResponse.body.data.totalSeats).toBe(3);
            expect(updateResponse.body.data.availableSeats).toBe(3);
            expect(updateResponse.body.data.driverName).toBe('Updated Driver');

            // Step 4: Verify update by retrieving again
            const verifyResponse = await request(app)
                .get(`/api/rides/${testRideId}`)
                .expect(200);

            expect(verifyResponse.body.data.fare).toBe(60);
            expect(verifyResponse.body.data.driverName).toBe('Updated Driver');
        });

        it('should handle ride booking and cancellation flow', async () => {
            // Step 1: Book seats in the ride
            const bookingData = {
                passengerName: 'Jane Smith',
                passengerContact: '9876543211',
                seatsRequested: 2
            };

            const bookResponse = await request(app)
                .post(`/api/rides/${testRideId}/book`)
                .send(bookingData)
                .expect(200);

            expect(bookResponse.body.success).toBe(true);
            expect(bookResponse.body.data.seatsBooked).toBe(2);
            expect(bookResponse.body.data.passengerName).toBe('Jane Smith');

            // Step 2: Verify ride seats are updated
            const rideAfterBooking = await request(app)
                .get(`/api/rides/${testRideId}`)
                .expect(200);

            expect(rideAfterBooking.body.data.availableSeats).toBe(1); // 3 total - 2 booked
            expect(rideAfterBooking.body.data.passengers).toHaveLength(1);
            expect(rideAfterBooking.body.data.passengers[0].name).toBe('Jane Smith');

            // Step 3: Try to book more seats than available
            const overBookingData = {
                passengerName: 'John Overbooker',
                passengerContact: '9876543212',
                seatsRequested: 2 // Only 1 seat available
            };

            await request(app)
                .post(`/api/rides/${testRideId}/book`)
                .send(overBookingData)
                .expect(400);

            // Step 4: Cancel the booking
            const passengerId = rideAfterBooking.body.data.passengers[0]._id;
            
            const cancelResponse = await request(app)
                .delete(`/api/rides/${testRideId}/cancel/${passengerId}`)
                .expect(200);

            expect(cancelResponse.body.success).toBe(true);

            // Step 5: Verify seats are released
            const rideAfterCancel = await request(app)
                .get(`/api/rides/${testRideId}`)
                .expect(200);

            expect(rideAfterCancel.body.data.availableSeats).toBe(3);
            expect(rideAfterCancel.body.data.passengers).toHaveLength(0);
        });

        it('should delete the ride successfully', async () => {
            // Delete the ride
            await request(app)
                .delete(`/api/rides/${testRideId}`)
                .expect(200);

            // Verify ride is deleted
            await request(app)
                .get(`/api/rides/${testRideId}`)
                .expect(404);
        });
    });

    describe('Location Management Journey', () => {
        it('should retrieve all locations', async () => {
            const response = await request(app)
                .get('/api/locations')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(3);
            expect(response.body.data[0].name).toBe('JS Palace PG');
        });

        it('should create new location (admin only)', async () => {
            if (!adminSession) {
                // Login first if session not available
                adminSession = request.agent(app);
                await adminSession
                    .post('/admin/login')
                    .send({
                        username: 'testadmin',
                        password: 'testpassword123'
                    });
            }

            const locationData = {
                name: 'New Test Location',
                type: 'office',
                address: 'Test Address, Gurgaon'
            };

            const createResponse = await adminSession
                .post('/api/locations')
                .send(locationData)
                .expect(201);

            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.data.name).toBe('New Test Location');

            // Verify creation by retrieving all locations
            const allLocations = await request(app)
                .get('/api/locations')
                .expect(200);

            expect(allLocations.body.data).toHaveLength(4);
        });

        it('should reject location creation by non-admin', async () => {
            const locationData = {
                name: 'Unauthorized Location',
                type: 'office',
                address: 'Test Address'
            };

            await request(app)
                .post('/api/locations')
                .send(locationData)
                .expect(401);
        });
    });

    describe('Search and Filter Journey', () => {
        beforeAll(async () => {
            // Create multiple test rides for search testing
            const testRides = [
                {
                    pickupLocation: 'JS Palace PG',
                    dropoffLocation: 'Cyber City Metro',
                    date: '2024-12-25',
                    time: '09:00',
                    totalSeats: 4,
                    fare: 50,
                    driverName: 'Driver 1',
                    driverContact: '9876543210'
                },
                {
                    pickupLocation: 'JS Palace PG',
                    dropoffLocation: 'DLF Mall',
                    date: '2024-12-25',
                    time: '10:00',
                    totalSeats: 3,
                    fare: 60,
                    driverName: 'Driver 2',
                    driverContact: '9876543211'
                },
                {
                    pickupLocation: 'Cyber City Metro',
                    dropoffLocation: 'DLF Mall',
                    date: '2024-12-26',
                    time: '08:30',
                    totalSeats: 2,
                    fare: 40,
                    driverName: 'Driver 3',
                    driverContact: '9876543212'
                }
            ];

            for (const ride of testRides) {
                await request(app)
                    .post('/api/rides')
                    .send(ride)
                    .expect(201);
            }
        });

        it('should search rides by pickup location', async () => {
            const response = await request(app)
                .get('/api/search?from=palace')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0].pickupLocation).toContain('Palace');
        });

        it('should search rides by destination', async () => {
            const response = await request(app)
                .get('/api/search?to=metro')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].dropoffLocation).toContain('Metro');
        });

        it('should search rides by date', async () => {
            const response = await request(app)
                .get('/api/search?date=2024-12-25')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.data[0].date).toBe('2024-12-25');
        });

        it('should search with multiple criteria', async () => {
            const response = await request(app)
                .get('/api/search?from=palace&to=mall&date=2024-12-25')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].dropoffLocation).toContain('Mall');
        });

        it('should filter rides by available seats', async () => {
            const response = await request(app)
                .get('/api/search?minSeats=3')
                .expect(200);

            expect(response.body.success).toBe(true);
            // Should return rides with 3 or more available seats
            response.body.data.forEach(ride => {
                expect(ride.availableSeats).toBeGreaterThanOrEqual(3);
            });
        });

        it('should filter rides by maximum fare', async () => {
            const response = await request(app)
                .get('/api/search?maxFare=50')
                .expect(200);

            expect(response.body.success).toBe(true);
            response.body.data.forEach(ride => {
                expect(ride.fare).toBeLessThanOrEqual(50);
            });
        });
    });

    describe('API Performance and Reliability', () => {
        it('should handle concurrent ride bookings correctly', async () => {
            // Create a ride with limited seats
            const rideData = {
                pickupLocation: 'JS Palace PG',
                dropoffLocation: 'Test Destination',
                date: '2024-12-25',
                time: '15:00',
                totalSeats: 2, // Only 2 seats available
                fare: 50,
                driverName: 'Concurrent Test Driver',
                driverContact: '9876543220'
            };

            const createResponse = await request(app)
                .post('/api/rides')
                .send(rideData)
                .expect(201);

            const concurrentRideId = createResponse.body.data._id;

            // Attempt concurrent bookings
            const bookingPromises = [
                request(app)
                    .post(`/api/rides/${concurrentRideId}/book`)
                    .send({
                        passengerName: 'Passenger 1',
                        passengerContact: '9876543221',
                        seatsRequested: 1
                    }),
                request(app)
                    .post(`/api/rides/${concurrentRideId}/book`)
                    .send({
                        passengerName: 'Passenger 2',
                        passengerContact: '9876543222',
                        seatsRequested: 1
                    }),
                request(app)
                    .post(`/api/rides/${concurrentRideId}/book`)
                    .send({
                        passengerName: 'Passenger 3',
                        passengerContact: '9876543223',
                        seatsRequested: 1
                    })
            ];

            const results = await Promise.allSettled(bookingPromises);
            
            // Count successful bookings
            const successfulBookings = results.filter(
                result => result.status === 'fulfilled' && result.value.status === 200
            ).length;

            // Should only allow 2 successful bookings
            expect(successfulBookings).toBe(2);

            // Verify final state
            const finalState = await request(app)
                .get(`/api/rides/${concurrentRideId}`)
                .expect(200);

            expect(finalState.body.data.availableSeats).toBe(0);
            expect(finalState.body.data.passengers).toHaveLength(2);
        });

        it('should validate response times are reasonable', async () => {
            const startTime = Date.now();
            
            await request(app)
                .get('/api/rides')
                .expect(200);
            
            const responseTime = Date.now() - startTime;
            
            // Response should be under 1 second for reasonable data size
            expect(responseTime).toBeLessThan(1000);
        });

        it('should handle malformed requests gracefully', async () => {
            // Invalid JSON
            const response = await request(app)
                .post('/api/rides')
                .send('invalid json')
                .set('Content-Type', 'application/json')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBeDefined();
        });
    });

    describe('Health and Monitoring', () => {
        it('should provide health status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.body.status).toBeDefined();
            expect(response.body.uptime).toBeDefined();
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.database).toBeDefined();
            expect(response.body.system).toBeDefined();
        });

        it('should provide metrics for authenticated admin', async () => {
            if (!adminSession) {
                adminSession = request.agent(app);
                await adminSession
                    .post('/admin/login')
                    .send({
                        username: 'testadmin',
                        password: 'testpassword123'
                    });
            }

            const response = await adminSession
                .get('/metrics')
                .expect(200);

            expect(response.body.requests).toBeDefined();
            expect(response.body.response_times).toBeDefined();
            expect(response.body.system).toBeDefined();
        });

        it('should reject metrics access for non-admin', async () => {
            await request(app)
                .get('/metrics')
                .expect(401);
        });
    });
});
