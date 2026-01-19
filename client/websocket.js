export class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.latency = null;
        this.messageQueue = [];
        this.isConnected = false;
        
        this.onMessage = null;
        this.onConnect = null;
        this.onDisconnect = null;
    }
    
    async connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname === 'localhost' ? 
            'localhost:3000' : window.location.host;
        
        const wsUrl = `${protocol}//${host}/ws`;
        
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);
                
                this.ws.onopen = () => {
                    console.log('WebSocket connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    
                    // Update UI
                    const status = document.getElementById('connection-status');
                    if (status) {
                        status.textContent = '● Connected';
                        status.className = 'connected';
                    }
                    
                    // Process queued messages
                    this.processMessageQueue();
                    
                    if (this.onConnect) this.onConnect();
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        
                        if (message.type === 'pong') {
                            this.latency = Date.now() - message.timestamp;
                        } else {
                            if (this.onMessage) {
                                this.onMessage(message);
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };
                
                this.ws.onclose = (event) => {
                    console.log('WebSocket disconnected:', event.code, event.reason);
                    this.isConnected = false;
                    
                    // Update UI
                    const status = document.getElementById('connection-status');
                    if (status) {
                        status.textContent = '● Disconnected';
                        status.className = 'disconnected';
                    }
                    
                    if (this.onDisconnect) this.onDisconnect();
                    
                    // Attempt to reconnect
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        setTimeout(() => {
                            this.reconnectAttempts++;
                            this.reconnectDelay *= 1.5; // Exponential backoff
                            console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
                            this.connect();
                        }, this.reconnectDelay);
                    }
                };
                
                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
                
                // Start ping interval
                setInterval(() => {
                    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                        this.send({
                            type: 'ping',
                            timestamp: Date.now()
                        });
                    }
                }, 30000);
                
            } catch (error) {
                console.error('Failed to connect to WebSocket:', error);
                reject(error);
            }
        });
    }
    
    send(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            // Queue message for when connection is restored
            this.messageQueue.push(message);
        }
    }
    
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send(message);
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}