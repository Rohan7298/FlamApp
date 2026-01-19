const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

class CollaborativeCanvasServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.clients = new Map(); // userId -> WebSocket
        this.rooms = new Map(); // roomId -> { users: Set, operations: Array }
        this.operations = []; // Global operation log
        
        this.setupMiddleware();
        this.setupWebSocket();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, '../client')));
        this.app.use(express.json());
    }
    
    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', users: this.clients.size });
        });
        
        this.app.post('/undo', (req, res) => {
            const { userId } = req.body;
            this.handleUndo(userId);
            res.json({ status: 'processing' });
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const userId = this.generateUserId();
            const userColor = this.generateRandomColor();
            
            console.log(`New connection: ${userId}`);
            
            // Store client
            this.clients.set(userId, {
                ws,
                userId,
                color: userColor,
                cursor: { x: 0, y: 0 },
                lastPing: Date.now()
            });
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                userId,
                color: userColor,
                users: Array.from(this.clients.values()).map(c => ({
                    id: c.userId,
                    color: c.color,
                    cursor: c.cursor
                }))
            }));
            
            // Broadcast new user to others
            this.broadcast({
                type: 'user-joined',
                userId,
                color: userColor
            }, userId);
            
            // Send existing operations
            if (this.operations.length > 0) {
                ws.send(JSON.stringify({
                    type: 'history',
                    operations: this.operations.slice(-100) // Last 100 operations
                }));
            }
            
            // Handle messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(userId, message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
            
            // Handle disconnection
            ws.on('close', () => {
                console.log(`Connection closed: ${userId}`);
                this.clients.delete(userId);
                this.broadcast({
                    type: 'user-left',
                    userId
                });
            });
            
            // Handle ping/pong for keep-alive
            ws.on('pong', () => {
                const client = this.clients.get(userId);
                if (client) {
                    client.lastPing = Date.now();
                }
            });
        });
        
        // Cleanup disconnected clients every 30 seconds
        setInterval(() => {
            const now = Date.now();
            for (const [userId, client] of this.clients.entries()) {
                if (now - client.lastPing > 60000) { // 60 seconds timeout
                    console.log(`Cleaning up inactive user: ${userId}`);
                    client.ws.terminate();
                    this.clients.delete(userId);
                    this.broadcast({
                        type: 'user-left',
                        userId
                    });
                }
            }
        }, 30000);
    }
    
    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateRandomColor() {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0',
            '#118AB2', '#073B4C', '#7209B7', '#F72585',
            '#3A0CA3', '#4361EE', '#4CC9F0'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    handleMessage(userId, message) {
        const client = this.clients.get(userId);
        if (!client) return;
        
        switch (message.type) {
            case 'draw':
                // Add timestamp and userId
                const operation = {
                    ...message.data,
                    userId,
                    timestamp: Date.now(),
                    operationId: this.generateOperationId()
                };
                
                // Store operation
                this.operations.push(operation);
                
                // Broadcast to all other clients
                this.broadcast({
                    type: 'draw',
                    data: operation
                }, userId);
                break;
                
            case 'cursor':
                // Update cursor position
                client.cursor = message.data;
                
                // Broadcast cursor movement to others
                this.broadcast({
                    type: 'cursor',
                    userId,
                    data: message.data
                }, userId);
                break;
                
            case 'clear':
                // Add clear operation to history
                const clearOp = {
                    type: 'clear',
                    userId,
                    timestamp: Date.now(),
                    operationId: this.generateOperationId()
                };
                
                this.operations.push(clearOp);
                this.broadcast({
                    type: 'clear',
                    data: clearOp
                }, userId);
                break;
                
            case 'undo':
                this.handleUndo(userId);
                break;
        }
    }
    
    handleUndo(userId) {
        // Find last operation by this user
        for (let i = this.operations.length - 1; i >= 0; i--) {
            if (this.operations[i].userId === userId) {
                const undoneOp = this.operations[i];
                
                // Create undo operation
                const undoOp = {
                    type: 'undo',
                    targetOperationId: undoneOp.operationId,
                    userId,
                    timestamp: Date.now(),
                    operationId: this.generateOperationId()
                };
                
                this.operations.push(undoOp);
                this.broadcast({
                    type: 'undo',
                    data: undoOp
                });
                break;
            }
        }
    }
    
    generateOperationId() {
        return 'op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    broadcast(message, excludeUserId = null) {
        const data = JSON.stringify(message);
        
        for (const [userId, client] of this.clients.entries()) {
            if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(data);
            }
        }
    }
    
    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log(`Open http://localhost:${port} in your browser`);
        });
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new CollaborativeCanvasServer();
    server.start(3000);
}

module.exports = CollaborativeCanvasServer;