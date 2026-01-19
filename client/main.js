import { DrawingCanvas } from './canvas.js';
import { WebSocketClient } from './websocket.js';

class CollaborativeDrawingApp {
    constructor() {
        this.canvas = new DrawingCanvas('drawing-canvas');
        this.wsClient = new WebSocketClient();
        this.userId = null;
        this.userColor = '#FF6B6B';
        this.users = new Map();
        
        this.currentTool = 'brush';
        this.currentColor = '#FF6B6B';
        this.brushSize = 5;
        this.isDrawing = false;
        
        this.operationHistory = [];
        this.redoHistory = [];
        
        this.init();
    }
    
    async init() {
        // Initialize canvas
        this.canvas.init();
        
        // Connect to WebSocket server
        await this.wsClient.connect();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Handle WebSocket messages
        this.wsClient.onMessage = this.handleWebSocketMessage.bind(this);
        
        // Start animation loop for FPS
        this.startAnimationLoop();
    }
    
    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                this.setTool(tool);
            });
        });
        
        // Color selection
        document.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const color = e.currentTarget.dataset.color;
                this.setColor(color);
            });
        });
        
        // Custom color picker
        document.getElementById('custom-color-picker').addEventListener('input', (e) => {
            this.setColor(e.target.value);
        });
        
        // Brush size slider
        const sizeSlider = document.getElementById('brush-size-slider');
        const sizeValue = document.getElementById('brush-size-value');
        
        sizeSlider.addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            sizeValue.textContent = `${this.brushSize}px`;
            this.canvas.setBrushSize(this.brushSize);
        });
        
        // Action buttons
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        document.getElementById('export-btn').addEventListener('click', () => this.exportCanvas());
        
        // Canvas events
        const canvas = this.canvas.canvas;
        
        canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        canvas.addEventListener('mousemove', (e) => this.draw(e));
        canvas.addEventListener('mouseup', () => this.stopDrawing());
        canvas.addEventListener('mouseleave', () => this.stopDrawing());
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.canvas.resize();
        });
    }
    
    setTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tool-btn[data-tool="${tool}"]`).classList.add('active');
        
        if (tool === 'clear') {
            this.clearCanvas();
            this.setTool('brush'); // Switch back to brush after clearing
        } else if (tool === 'eraser') {
            this.canvas.setTool('eraser');
        } else {
            this.canvas.setTool('brush');
        }
    }
    
    setColor(color) {
        this.currentColor = color;
        
        // Update UI
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`.color-option[data-color="${color}"]`)?.classList.add('active');
        document.getElementById('custom-color-picker').value = color;
        
        this.canvas.setColor(color);
    }
    
    startDrawing(e) {
        if (this.currentTool === 'clear') return;
        
        const rect = this.canvas.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.isDrawing = true;
        this.canvas.startDrawing(x, y);
        
        // Send cursor position
        this.wsClient.send({
            type: 'cursor',
            data: { x, y }
        });
    }
    
    draw(e) {
        if (!this.isDrawing) {
            // Still send cursor position even when not drawing
            const rect = this.canvas.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.wsClient.send({
                type: 'cursor',
                data: { x, y }
            });
            return;
        }
        
        const rect = this.canvas.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Draw locally
        this.canvas.draw(x, y);
        
        // Get the drawn points
        const points = this.canvas.getCurrentPath();
        
        // Send drawing data to server
        if (points.length > 0) {
            this.wsClient.send({
                type: 'draw',
                data: {
                    points: points.slice(-2), // Send last 2 points for efficiency
                    color: this.currentColor,
                    width: this.brushSize,
                    tool: this.currentTool
                }
            });
        }
        
        // Send cursor position
        this.wsClient.send({
            type: 'cursor',
            data: { x, y }
        });
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.canvas.stopDrawing();
        
        // Add to local history
        const path = this.canvas.getCurrentPath();
        if (path.length > 0) {
            this.operationHistory.push({
                points: [...path],
                color: this.currentColor,
                width: this.brushSize,
                tool: this.currentTool,
                timestamp: Date.now()
            });
            this.redoHistory = []; // Clear redo history on new operation
            
            // Update operation count
            this.updateOperationCount();
        }
    }
    
    clearCanvas() {
        this.canvas.clear();
        
        this.wsClient.send({
            type: 'clear'
        });
        
        this.showNotification('Canvas cleared');
    }
    
    undo() {
        if (this.operationHistory.length === 0) return;
        
        const lastOp = this.operationHistory.pop();
        this.redoHistory.push(lastOp);
        
        // Clear canvas and redraw all operations except the last one
        this.canvas.clear();
        
        // Redraw all operations except undone one
        for (const op of this.operationHistory) {
            this.canvas.drawPath(op.points, op.color, op.width, op.tool);
        }
        
        // Send undo to server
        this.wsClient.send({
            type: 'undo'
        });
        
        this.updateOperationCount();
        this.showNotification('Undo performed');
    }
    
    redo() {
        if (this.redoHistory.length === 0) return;
        
        const lastRedo = this.redoHistory.pop();
        this.operationHistory.push(lastRedo);
        
        // Redraw the redone operation
        this.canvas.drawPath(lastRedo.points, lastRedo.color, lastRedo.width, lastRedo.tool);
        
        this.updateOperationCount();
        this.showNotification('Redo performed');
    }
    
    exportCanvas() {
        const dataURL = this.canvas.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'collaborative-drawing.png';
        link.href = dataURL;
        link.click();
        
        this.showNotification('Canvas exported as PNG');
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'welcome':
                this.handleWelcome(message);
                break;
                
            case 'user-joined':
                this.handleUserJoined(message);
                break;
                
            case 'user-left':
                this.handleUserLeft(message);
                break;
                
            case 'draw':
                this.handleRemoteDraw(message.data);
                break;
                
            case 'cursor':
                this.handleRemoteCursor(message.userId, message.data);
                break;
                
            case 'clear':
                this.handleRemoteClear();
                break;
                
            case 'undo':
                this.handleRemoteUndo(message.data);
                break;
                
            case 'history':
                this.handleHistory(message.operations);
                break;
        }
    }
    
    handleWelcome(message) {
        this.userId = message.userId;
        this.userColor = message.color;
        
        // Update UI
        document.getElementById('user-color-badge').style.backgroundColor = this.userColor;
        this.setColor(this.userColor);
        
        // Update users list
        this.updateUsersList(message.users);
        
        this.showNotification(`Connected as ${this.userId.substring(0, 8)}...`);
    }
    
    handleUserJoined(message) {
        this.users.set(message.userId, {
            id: message.userId,
            color: message.color,
            cursor: { x: 0, y: 0 }
        });
        
        this.updateUsersList(Array.from(this.users.values()));
        this.showNotification(`User ${message.userId.substring(0, 8)}... joined`);
    }
    
    handleUserLeft(message) {
        this.users.delete(message.userId);
        
        // Remove cursor
        const cursor = document.getElementById(`cursor-${message.userId}`);
        if (cursor) cursor.remove();
        
        this.updateUsersList(Array.from(this.users.values()));
        this.showNotification(`User ${message.userId.substring(0, 8)}... left`);
    }
    
    handleRemoteDraw(operation) {
        // Don't draw our own operations (already drawn locally)
        if (operation.userId === this.userId) return;
        
        // Draw the remote operation
        this.canvas.drawPath(operation.points, operation.color, operation.width, operation.tool);
    }
    
    handleRemoteCursor(userId, position) {
        const user = this.users.get(userId);
        if (!user) return;
        
        user.cursor = position;
        
        // Update or create cursor element
        let cursor = document.getElementById(`cursor-${userId}`);
        
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = `cursor-${userId}`;
            cursor.className = 'remote-cursor';
            cursor.style.color = user.color;
            document.getElementById('remote-cursors').appendChild(cursor);
        }
        
        // Convert canvas coordinates to screen coordinates
        const rect = this.canvas.canvas.getBoundingClientRect();
        cursor.style.left = `${position.x}px`;
        cursor.style.top = `${position.y}px`;
        
        // Add user ID label on hover
        cursor.title = userId.substring(0, 8) + '...';
    }
    
    handleRemoteClear() {
        this.canvas.clear();
        this.operationHistory = [];
        this.redoHistory = [];
        this.updateOperationCount();
    }
    
    handleRemoteUndo(operation) {
        // For now, just clear and redraw everything from history
        // In production, this would be more sophisticated
        this.showNotification(`User ${operation.userId.substring(0, 8)}... performed undo`);
    }
    
    handleHistory(operations) {
        // Draw all historical operations
        for (const op of operations) {
            if (op.type === 'clear') {
                this.canvas.clear();
            } else if (op.points) {
                this.canvas.drawPath(op.points, op.color, op.width, op.tool);
            }
        }
    }
    
    updateUsersList(users) {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        // Add current user first
        usersList.appendChild(this.createUserElement({
            id: this.userId,
            color: this.userColor,
            isCurrentUser: true
        }));
        
        // Add other users
        users.filter(user => user.id !== this.userId).forEach(user => {
            usersList.appendChild(this.createUserElement(user));
        });
        
        // Update user count
        document.getElementById('user-count').textContent = `${users.length} user${users.length !== 1 ? 's' : ''} online`;
    }
    
    createUserElement(user) {
        const div = document.createElement('div');
        div.className = `user-item ${user.isCurrentUser ? 'user-you' : ''}`;
        
        div.innerHTML = `
            <div class="user-color" style="background-color: ${user.color}"></div>
            <div class="user-name">
                ${user.isCurrentUser ? 'You' : user.id.substring(0, 8)}...
            </div>
        `;
        
        return div;
    }
    
    updateOperationCount() {
        document.getElementById('operation-count').textContent = 
            `Operations: ${this.operationHistory.length}`;
        
        // Update undo/redo buttons
        document.getElementById('undo-btn').disabled = this.operationHistory.length === 0;
        document.getElementById('redo-btn').disabled = this.redoHistory.length === 0;
    }
    
    showNotification(message) {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    startAnimationLoop() {
        let lastTime = 0;
        let frames = 0;
        let fps = 0;
        
        const updateFPS = (timestamp) => {
            frames++;
            
            if (timestamp - lastTime >= 1000) {
                fps = frames;
                frames = 0;
                lastTime = timestamp;
                
                document.getElementById('fps-counter').textContent = `FPS: ${fps}`;
                
                // Update latency display
                if (this.wsClient.latency) {
                    document.getElementById('latency-display').textContent = 
                        `Latency: ${Math.round(this.wsClient.latency)}ms`;
                }
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CollaborativeDrawingApp();
});