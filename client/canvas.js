export class DrawingCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.currentPath = [];
        this.isDrawing = false;
        
        // Default settings
        this.color = '#FF6B6B';
        this.brushSize = 5;
        this.tool = 'brush';
        
        // For smooth drawing
        this.lastX = 0;
        this.lastY = 0;
        
        // Initialize canvas size
        this.resize();
    }
    
    init() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = 'source-over';
        
        // Set initial color and size
        this.setColor(this.color);
        this.setBrushSize(this.brushSize);
        
        // Handle window resize
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Set canvas size to match container (accounting for padding)
        const width = rect.width - 40; // Subtract padding
        const height = rect.height - 40; // Subtract padding
        
        // Only resize if dimensions changed
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Redraw existing content
            this.redraw();
        }
    }
    
    setColor(color) {
        this.color = color;
        this.ctx.strokeStyle = color;
    }
    
    setBrushSize(size) {
        this.brushSize = size;
        this.ctx.lineWidth = size;
    }
    
    setTool(tool) {
        this.tool = tool;
        if (tool === 'eraser') {
            this.ctx.globalCompositeOperation = 'destination-out';
        } else {
            this.ctx.globalCompositeOperation = 'source-over';
        }
    }
    
    startDrawing(x, y) {
        this.isDrawing = true;
        this.currentPath = [{x, y}];
        this.lastX = x;
        this.lastY = y;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }
    
    draw(x, y) {
        if (!this.isDrawing) return;
        
        // Add point to current path
        this.currentPath.push({x, y});
        
        // Draw with smoothing
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        
        this.lastX = x;
        this.lastY = y;
    }
    
    stopDrawing() {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.ctx.closePath();
    }
    
    drawPath(points, color, width, tool) {
        if (!points || points.length < 2) return;
        
        const previousColor = this.ctx.strokeStyle;
        const previousWidth = this.ctx.lineWidth;
        const previousComposite = this.ctx.globalCompositeOperation;
        
        // Set drawing properties
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        
        // Draw the path
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        
        this.ctx.stroke();
        this.ctx.closePath();
        
        // Restore previous properties
        this.ctx.strokeStyle = previousColor;
        this.ctx.lineWidth = previousWidth;
        this.ctx.globalCompositeOperation = previousComposite;
    }
    
    getCurrentPath() {
        return [...this.currentPath];
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentPath = [];
    }
    
    redraw() {
        // This would redraw all stored paths
        // In a full implementation, we would store all paths and redraw them here
    }
    
    getCanvasData() {
        return this.canvas.toDataURL();
    }
}