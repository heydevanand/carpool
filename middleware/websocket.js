/**
 * WebSocket Manager - Real-time communication system
 * Provides real-time updates for ride bookings, driver locations, and system notifications
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const config = require('../config/environment');

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map(); // userId -> { ws, lastPing, rooms }
        this.rooms = new Map(); // roomId -> Set of userIds
        this.metrics = {
            connections: 0,
            messagesPerSecond: 0,
            messageCount: 0,
            lastReset: Date.now()
        };
        
        this.setupMetricsReset();
    }

    initialize(server) {
        this.wss = new WebSocket.Server({
            server,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });

        this.wss.on('connection', this.handleConnection.bind(this));
        this.setupPingPong();
        
        logger.info('WebSocket server initialized');
        return this.wss;
    }

    verifyClient(info) {
        try {
            const url = new URL(info.req.url, 'http://localhost');
            const token = url.searchParams.get('token');
            
            if (!token) {
                return false;
            }

            const decoded = jwt.verify(token, config.jwt.secret || 'fallback-secret');
            info.req.user = decoded;
            return true;
        } catch (error) {
            logger.warn('WebSocket authentication failed', { error: error.message });
            return false;
        }
    }

    handleConnection(ws, req) {
        const userId = req.user?.id || `anonymous-${Date.now()}`;
        const userType = req.user?.type || 'user';
        
        // Store client connection
        this.clients.set(userId, {
            ws,
            lastPing: Date.now(),
            rooms: new Set(),
            userType,
            userId
        });

        this.metrics.connections++;
        
        logger.info('WebSocket client connected', { userId, userType });

        // Join user to personal room
        this.joinRoom(userId, `user:${userId}`);

        // Send welcome message
        this.sendToUser(userId, {
            type: 'connected',
            data: {
                message: 'Connected to real-time service',
                timestamp: new Date().toISOString()
            }
        });

        // Handle incoming messages
        ws.on('message', (data) => this.handleMessage(userId, data));
        
        // Handle disconnection
        ws.on('close', () => this.handleDisconnection(userId));
        
        // Handle errors
        ws.on('error', (error) => {
            logger.error('WebSocket error', { userId, error: error.message });
        });

        // Send ping
        ws.ping();
    }

    handleMessage(userId, data) {
        try {
            const message = JSON.parse(data.toString());
            this.metrics.messageCount++;
            
            logger.debug('WebSocket message received', { userId, type: message.type });

            switch (message.type) {
                case 'join_room':
                    this.joinRoom(userId, message.roomId);
                    break;
                    
                case 'leave_room':
                    this.leaveRoom(userId, message.roomId);
                    break;
                    
                case 'location_update':
                    this.handleLocationUpdate(userId, message.data);
                    break;
                    
                case 'ride_status':
                    this.handleRideStatusRequest(userId, message.data);
                    break;
                    
                case 'ping':
                    this.sendToUser(userId, { type: 'pong', timestamp: Date.now() });
                    break;
                    
                default:
                    logger.warn('Unknown WebSocket message type', { userId, type: message.type });
            }
        } catch (error) {
            logger.error('Error handling WebSocket message', { userId, error: error.message });
        }
    }

    handleDisconnection(userId) {
        const client = this.clients.get(userId);
        if (client) {
            client.rooms.forEach(roomId => {
                this.leaveRoom(userId, roomId);
            });
            
            this.clients.delete(userId);
            this.metrics.connections--;
            
            logger.info('WebSocket client disconnected', { userId });
        }
    }

    joinRoom(userId, roomId) {
        const client = this.clients.get(userId);
        if (!client) return;

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(userId);
        client.rooms.add(roomId);

        this.sendToUser(userId, {
            type: 'room_joined',
            data: { roomId }
        });

        logger.debug('User joined room', { userId, roomId });
    }

    leaveRoom(userId, roomId) {
        const client = this.clients.get(userId);
        if (!client) return;

        const room = this.rooms.get(roomId);
        if (room) {
            room.delete(userId);
            if (room.size === 0) {
                this.rooms.delete(roomId);
            }
        }
        client.rooms.delete(roomId);

        this.sendToUser(userId, {
            type: 'room_left',
            data: { roomId }
        });

        logger.debug('User left room', { userId, roomId });
    }

    sendToUser(userId, message) {
        const client = this.clients.get(userId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                logger.error('Error sending message to user', { userId, error: error.message });
                return false;
            }
        }
        return false;
    }

    sendToRoom(roomId, message, excludeUserId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return 0;

        let sentCount = 0;
        room.forEach(userId => {
            if (userId !== excludeUserId) {
                if (this.sendToUser(userId, message)) {
                    sentCount++;
                }
            }
        });

        return sentCount;
    }

    broadcast(message, userType = null) {
        let sentCount = 0;
        this.clients.forEach((client, userId) => {
            if (!userType || client.userType === userType) {
                if (this.sendToUser(userId, message)) {
                    sentCount++;
                }
            }
        });
        return sentCount;
    }

    // Ride-specific notifications
    notifyRideBooked(rideId, rideData) {
        const message = {
            type: 'ride_booked',
            data: {
                rideId,
                ...rideData,
                timestamp: new Date().toISOString()
            }
        };

        this.sendToUser(rideData.driverId, message);
        
        if (rideData.passengers) {
            rideData.passengers.forEach(passengerId => {
                this.sendToUser(passengerId, message);
            });
        }

        this.sendToRoom(`ride:${rideId}`, message);
    }

    notifyRideStatusUpdate(rideId, status, rideData) {
        const message = {
            type: 'ride_status_update',
            data: {
                rideId,
                status,
                ...rideData,
                timestamp: new Date().toISOString()
            }
        };

        this.sendToRoom(`ride:${rideId}`, message);
    }

    handleLocationUpdate(userId, locationData) {
        const client = this.clients.get(userId);
        if (!client || client.userType !== 'driver') return;

        client.rooms.forEach(roomId => {
            if (roomId.startsWith('ride:')) {
                this.sendToRoom(roomId, {
                    type: 'driver_location_update',
                    data: {
                        driverId: userId,
                        location: locationData,
                        timestamp: new Date().toISOString()
                    }
                }, userId);
            }
        });
    }

    setupPingPong() {
        setInterval(() => {
            this.clients.forEach((client, userId) => {
                if (client.ws.readyState === WebSocket.OPEN) {
                    if (Date.now() - client.lastPing > 60000) {
                        logger.warn('Client ping timeout', { userId });
                        client.ws.terminate();
                        return;
                    }

                    client.ws.ping();
                    client.ws.on('pong', () => {
                        client.lastPing = Date.now();
                    });
                }
            });
        }, 30000);
    }

    setupMetricsReset() {
        setInterval(() => {
            const now = Date.now();
            const elapsed = (now - this.metrics.lastReset) / 1000;
            this.metrics.messagesPerSecond = this.metrics.messageCount / elapsed;
            this.metrics.messageCount = 0;
            this.metrics.lastReset = now;
        }, 10000);
    }

    getMetrics() {
        return {
            ...this.metrics,
            activeConnections: this.clients.size,
            activeRooms: this.rooms.size,
            clientsByType: this.getClientsByType()
        };
    }

    getClientsByType() {
        const types = {};
        this.clients.forEach(client => {
            types[client.userType] = (types[client.userType] || 0) + 1;
        });
        return types;
    }

    isHealthy() {
        return {
            status: this.wss ? 'healthy' : 'unhealthy',
            connections: this.clients.size,
            uptime: process.uptime()
        };
    }

    close() {
        if (this.wss) {
            logger.info('Closing WebSocket server...');
            
            this.broadcast({
                type: 'server_shutdown',
                data: {
                    message: 'Server is shutting down',
                    timestamp: new Date().toISOString()
                }
            });

            this.clients.forEach((client, userId) => {
                client.ws.close(1001, 'Server shutdown');
            });

            this.wss.close();
            this.clients.clear();
            this.rooms.clear();
        }
    }
}

module.exports = new WebSocketManager();