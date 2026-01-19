class DrawingState {
    constructor() {
        this.operations = [];
        this.undoStack = [];
        this.redoStack = [];
        this.version = 0;
    }
    
    addOperation(operation) {
        operation.version = ++this.version;
        this.operations.push(operation);
        this.undoStack.push(operation);
        this.redoStack = []; // Clear redo stack on new operation
        return operation;
    }
    
    getOperationsAfter(version) {
        return this.operations.filter(op => op.version > version);
    }
    
    undo(userId) {
        // Find last operation by this user
        for (let i = this.operations.length - 1; i >= 0; i--) {
            if (this.operations[i].userId === userId) {
                const operation = this.operations[i];
                this.operations.splice(i, 1);
                this.undoStack = this.undoStack.filter(op => op.operationId !== operation.operationId);
                return operation;
            }
        }
        return null;
    }
    
    redo(userId) {
        // Simple implementation - in production, would need more sophisticated approach
        return null;
    }
    
    getState() {
        return {
            operations: this.operations,
            version: this.version
        };
    }
}

module.exports = DrawingState;