# Flamapp - Collaborative Drawing Canvas Architecture

## System Overview

Flamapp is a real-time collaborative drawing web application that enables multiple users to draw simultaneously on a shared HTML5 canvas. Built with a minimalist tech stack, the system uses WebSockets for bidirectional communication and implements custom drawing logic without heavy external dependencies.

### Key Features
- **Real-time Collaboration**: Multiple users can draw simultaneously with immediate visual feedback
- **Tool Suite**: Brush, eraser, and customizable color palette
- **Undo/Redo**: Operation history management with per-user undo support
- **User Presence**: Real-time cursor tracking and user indicators
- **Export**: Download canvas as image
- **Responsive**: Touch-enabled for mobile devices
- **Connection Resilience**: Automatic reconnection with exponential backoff

### Tech Stack
- **Backend**: Node.js + Express + WebSocket (ws library)
- **Frontend**: Vanilla JavaScript (ES6 modules) + HTML5 Canvas API
- **Communication**: WebSocket protocol (ws://)
- **State Management**: In-memory operation log with versioning

### Design Principles
1. **Real-time First**: Optimized for immediate feedback and low latency
2. **Simplicity Over Complexity**: Minimal dependencies, straightforward architecture
3. **Progressive Enhancement**: Core drawing features work reliably, enhanced UX on top
4. **Transparent State**: Event sourcing with operation logs for debugging and replay
5. **No Framework Lock-in**: Pure JavaScript for maintainability and learning

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    index.html (UI)                         │ │
│  │  - Canvas container                                        │ │
│  │  - Toolbar (tools, colors, sizes)                          │ │
│  │  - User indicators                                         │ │
│  │  - Status bar (FPS, connection, users)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ↕                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              main.js (Application Controller)              │ │
│  │  - Initializes canvas & WebSocket                          │ │
│  │  - Event handling & routing                                │ │
│  │  - Tool state management                                   │ │
│  │  - Operation history (undo/redo)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│          ↕                                        ↕              │
│  ┌──────────────────────┐           ┌──────────────────────┐   │
│  │   canvas.js          │           │   websocket.js       │   │
│  │ (Drawing Engine)     │           │ (Network Layer)      │   │
│  │                      │           │                      │   │
│  │ - Canvas rendering   │           │ - WS connection      │   │
│  │ - Drawing operations │           │ - Message queue      │   │
│  │ - Path smoothing     │           │ - Auto-reconnect     │   │
│  │ - Tool switching     │           │ - Latency tracking   │   │
│  │ - Remote drawing     │           │ - Ping/pong          │   │
│  └──────────────────────┘           └──────────────────────┘   │
│                                                ↕                 │
└────────────────────────────────────────────────────────────────┘
                                                 ↕
                                          WebSocket (ws://)
                                                 ↕
┌─────────────────────────────────────────────────────────────────┐
│                        NODE.JS SERVER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   server.js (Main Server)                  │ │
│  │  CollaborativeCanvasServer Class                           │ │
│  │  - Express HTTP server                                     │ │
│  │  - WebSocket server setup                                  │ │
│  │  - Client connection management                            │ │
│  │  - Message routing & broadcasting                          │ │
│  │  - User lifecycle (join/leave)                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ↕                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            drawing-state.js (State Manager)                │ │
│  │  DrawingState Class                                        │ │
│  │  - Operation log storage                                   │ │
│  │  - Version tracking                                        │ │
│  │  - Undo/redo stacks                                        │ │
│  │  - State queries (getOperationsAfter)                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Data Structures                         │ │
│  │  - clients: Map<userId, {ws, color, cursor}>               │ │
│  │  - operations: Array<Operation>                            │ │
│  │  - rooms: Map<roomId, {users, operations}> (future)        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Client-Side Components

#### 1. **main.js** - Application Controller
**Responsibilities:**
- Initialize and coordinate canvas and WebSocket modules
- Handle UI events (tool selection, color picking, button clicks)
- Manage application state (current tool, color, brush size)
- Route WebSocket messages to appropriate handlers
- Maintain operation history for undo/redo
- Update status bar (FPS, user count, latency)

**Key Methods:**
```javascript
init()                          // Application initialization
setupEventListeners()           // Bind UI events
handleWebSocketMessage(msg)     // Process incoming messages
startDrawing(e) / draw(e)      // Drawing event handlers
undo() / redo()                // History management
broadcastOperation(op)          // Send drawing ops to server
```

**State:**
- `userId`, `userColor` - Current user identity
- `currentTool`, `currentColor`, `brushSize` - Drawing settings
- `users` - Map of connected users
- `operationHistory`, `redoHistory` - Command pattern stacks

#### 2. **canvas.js** - Drawing Engine
**Responsibilities:**
- Manage HTML5 Canvas rendering context
- Execute local and remote drawing operations
- Handle tool switching (brush, eraser)
- Implement smooth path drawing
- Responsive canvas sizing

**Key Methods:**
```javascript
init()                          // Initialize canvas context
startDrawing(x, y)             // Begin drawing path
draw(x, y)                     // Continue drawing path
stopDrawing()                  // Complete drawing path
drawOperation(operation)        // Render remote operation
setTool(tool) / setColor(color) // Tool configuration
clear()                        // Clear canvas
```

**Features:**
- Line smoothing with `lineCap: 'round'` and `lineJoin: 'round'`
- Eraser via `globalCompositeOperation: 'destination-out'`
- Auto-resize with window resize events

#### 3. **websocket.js** - Network Layer
**Responsibilities:**
- Establish and maintain WebSocket connection
- Handle connection lifecycle (connect, disconnect, reconnect)
- Queue messages during disconnection
- Track connection latency via ping/pong
- Update connection status UI

**Key Methods:**
```javascript
connect()                      // Establish WebSocket connection
send(message)                  // Send message to server
processMessageQueue()          // Send queued messages
disconnect()                   // Close connection gracefully
```

**Features:**
- Automatic reconnection with exponential backoff
- Message queueing during disconnection
- Latency measurement
- Protocol detection (ws:// vs wss://)

### Server-Side Components

#### 1. **server.js** - Main Server Class
**Responsibilities:**
- HTTP server for serving static files
- WebSocket server for real-time communication
- Client connection management
- Message routing and broadcasting
- User lifecycle management

**Key Methods:**
```javascript
setupMiddleware()              // Configure Express
setupWebSocket()               // Configure WebSocket server
handleMessage(userId, msg)     // Route incoming messages
broadcast(msg, excludeUserId)  // Send to all clients
generateUserId()               // Create unique user IDs
generateRandomColor()          // Assign user colors
```

**Message Types Handled:**
- `draw` - Drawing operations from clients
- `cursor-move` - User cursor position updates
- `clear` - Clear canvas requests
- `undo` - Undo operation requests
- `ping` - Heartbeat/latency measurement

**Message Types Sent:**
- `welcome` - Initial connection with user ID and color
- `user-joined` / `user-left` - User presence updates
- `history` - Send last 100 operations to new clients
- `operation` - Broadcast drawing operations
- `operation-removed` - Broadcast undo operations
- `cursor-update` - Other users' cursor positions

#### 2. **drawing-state.js** - State Manager
**Responsibilities:**
- Maintain operation log (event sourcing)
- Track version numbers for synchronization
- Implement undo/redo logic
- Query operations by version

**Key Methods:**
```javascript
addOperation(operation)        // Add new operation to log
getOperationsAfter(version)    // Sync operations after version
undo(userId)                   // Remove last user operation
getState()                     // Get current state snapshot
```

**Data Structures:**
```javascript
operations: [
  {
    operationId: string,
    type: 'draw' | 'erase' | 'clear',
    userId: string,
    path: Array<{x, y}>,
    color: string,
    brushSize: number,
    version: number,
    timestamp: number
  }
]
```

---

## Data Flow

### 1. Drawing Operation Flow

```
User Action (mousedown/move/up)
           ↓
[main.js] Capture coordinates
           ↓
[canvas.js] Draw locally
           ↓
[main.js] Create operation object
           ↓
[websocket.js] Send to server
           ↓
[server.js] Receive operation
           ↓
[drawing-state.js] Store operation
           ↓
[server.js] Broadcast to all clients (except sender)
           ↓
[Client websocket.js] Receive operation
           ↓
[Client main.js] Process message
           ↓
[Client canvas.js] Render operation
```

### 2. New User Connection Flow

```
Client connects
           ↓
[server.js] Generate userId & color
           ↓
Send 'welcome' message with userId, color, user list
           ↓
Send 'history' with last 100 operations
           ↓
Broadcast 'user-joined' to other clients
           ↓
[Client] Render existing users & history
           ↓
[Client] Ready to draw
```

### 3. Undo Flow

```
User clicks Undo button
           ↓
[main.js] Call undo()
           ↓
[websocket.js] Send 'undo' message
           ↓
[server.js] Handle undo request
           ↓
[drawing-state.js] Find & remove last operation by user
           ↓
[server.js] Broadcast 'operation-removed' to all clients
           ↓
[Clients] Re-render canvas from operation history
```

---

## State Management

### Client State
- **Local State**: Current tool, color, brush size, drawing flag
- **User State**: userId, userColor, cursor position
- **Peer State**: Map of connected users with their colors and cursors
- **History State**: Operation log for undo/redo (client-side only for redo)

### Server State
- **Connection State**: Map of userId → WebSocket connections
- **User State**: userId, color, cursor position, last ping time
- **Drawing State**: Global operation log with versioning
- **Room State**: (Future) Map of roomId → room data for multi-room support

### State Synchronization
- **Event Sourcing**: All drawing operations stored as events
- **Operation Log**: Append-only log for replay and debugging
- **Version Tracking**: Each operation has a version number
- **History Sync**: New clients receive last 100 operations
- **Eventual Consistency**: All clients converge to same state

---

## Communication Protocol

### WebSocket Message Format
All messages are JSON-encoded with a `type` field:

#### Client → Server Messages

**Draw Operation:**
```json
{
  "type": "draw",
  "operationId": "uuid-v4",
  "userId": "user-123",
  "tool": "brush",
  "path": [{"x": 100, "y": 200}, ...],
  "color": "#FF6B6B",
  "brushSize": 5,
  "timestamp": 1234567890
}
```

**Cursor Move:**
```json
{
  "type": "cursor-move",
  "x": 150,
  "y": 250
}
```

**Clear Canvas:**
```json
{
  "type": "clear"
}
```

**Undo:**
```json
{
  "type": "undo"
}
```

**Ping:**
```json
{
  "type": "ping",
  "timestamp": 1234567890
}
```

#### Server → Client Messages

**Welcome:**
```json
{
  "type": "welcome",
  "userId": "user-123",
  "color": "#FF6B6B",
  "users": [
    {"id": "user-456", "color": "#4ECDC4", "cursor": {"x": 100, "y": 100}}
  ]
}
```

**History:**
```json
{
  "type": "history",
  "operations": [/* last 100 operations */]
}
```

**Operation Broadcast:**
```json
{
  "type": "operation",
  "operation": {/* same as draw operation */}
}
```

**User Joined:**
```json
{
  "type": "user-joined",
  "userId": "user-789",
  "color": "#95E1D3"
}
```

**User Left:**
```json
{
  "type": "user-left",
  "userId": "user-456"
}
```

**Cursor Update:**
```json
{
  "type": "cursor-update",
  "userId": "user-456",
  "cursor": {"x": 200, "y": 300}
}
```

**Operation Removed (Undo):**
```json
{
  "type": "operation-removed",
  "operationId": "uuid-v4"
}
```

**Pong:**
```json
{
  "type": "pong",
  "timestamp": 1234567890
}
```

---

## Key Algorithms

### 1. Smooth Line Drawing
- Use Canvas API's `lineTo()` with `lineCap: 'round'` and `lineJoin: 'round'`
- Store path as array of points for transmission
- Redraw entire path on receiving client

### 2. Eraser Implementation
- Set `globalCompositeOperation` to `'destination-out'`
- Draw with same path logic as brush
- Reset to `'source-over'` when switching back to brush

### 3. Reconnection with Exponential Backoff
```javascript
reconnectDelay = initialDelay * (1.5 ^ attempt)
maxAttempts = 5
```

### 4. Operation Versioning
- Each operation gets a monotonically increasing version number
- Clients can request operations after their last known version
- Enables delta synchronization for disconnected clients

### 5. Canvas Redraw from History
```javascript
clear canvas
for each operation in history:
  setColor(operation.color)
  setBrushSize(operation.brushSize)
  drawPath(operation.path)
```

---

## Performance Considerations

### Client-Side
1. **Canvas Optimization**
   - Use `requestAnimationFrame` for FPS counter
   - Batch operations before redraw
   - Limit path point density for large drawings

2. **Message Throttling**
   - Cursor position updates throttled to avoid flooding
   - Drawing operations batched during rapid movements

3. **Memory Management**
   - Limit operation history size (e.g., last 1000 operations)
   - Clear old operations to prevent memory leaks

### Server-Side
1. **Broadcasting**
   - Exclude sender from broadcasts to avoid echo
   - Use WebSocket binary frames for large data (future optimization)

2. **State Management**
   - Limit operation log size (circular buffer or periodic pruning)
   - Consider Redis for distributed deployments

3. **Connection Management**
   - Track last ping time to detect zombie connections
   - Implement connection timeout and cleanup

---

## Security Considerations

### Current State
- No authentication/authorization
- No input validation
- No rate limiting
- All operations trusted

### Production Recommendations
1. **Authentication**
   - Add user authentication (JWT, OAuth)
   - Validate user identity on each operation

2. **Input Validation**
   - Validate operation structure and values
   - Sanitize user inputs
   - Limit path size and operation frequency

3. **Rate Limiting**
   - Limit operations per user per second
   - Prevent flooding attacks
   - Implement backpressure

4. **Authorization**
   - Room-based access control
   - Admin/moderator roles
   - Ability to ban users

5. **Data Sanitization**
   - Validate colors (hex format)
   - Limit brush size range
   - Constrain coordinates to canvas bounds

---

## Scalability Strategy

### Current Limitations
- Single server instance
- In-memory state (no persistence)
- No horizontal scaling

### Scaling Approaches

#### 1. Horizontal Scaling
- Use Redis Pub/Sub for inter-server communication
- Sticky sessions for WebSocket connections
- Shared state via Redis

#### 2. Persistence Layer
- Add database (PostgreSQL, MongoDB) for operation log
- Implement periodic snapshots
- Enable canvas history and replay

#### 3. Room-Based Partitioning
- Separate rooms/canvases
- Distribute rooms across servers
- Implement room discovery service

#### 4. CDN & Edge
- Serve static files via CDN
- Use edge functions for WebSocket termination
- Reduce latency with geographic distribution

---

## Deployment

### Development
```bash
npm install
npm run dev  # Uses nodemon for auto-reload
```
Server runs on `http://localhost:3000`

### Production
```bash
npm install --production
npm start
```

### Environment Variables
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### Docker Deployment (Future)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Testing Strategy

### Unit Tests (Recommended)
- **canvas.js**: Drawing operations, tool switching
- **drawing-state.js**: Operation log management, undo/redo
- **websocket.js**: Connection logic, message queue

### Integration Tests
- Client-server communication
- Multi-user drawing scenarios
- Reconnection behavior
- Operation synchronization

### E2E Tests
- Full user flow from connection to drawing
- Multiple concurrent users
- Network interruption scenarios

---

## Future Enhancements

### Features
1. **Shapes & Tools**
   - Rectangle, circle, line tools
   - Fill bucket
   - Text tool

2. **Layers**
   - Multiple drawing layers
   - Layer visibility and ordering

3. **Collaboration Features**
   - Chat/voice communication
   - User avatars
   - Permissions (read-only users)

4. **Persistence**
   - Save/load canvas
   - Canvas versioning
   - User accounts

5. **UI/UX**
   - Keyboard shortcuts
   - Grid/rulers
   - Zoom and pan
   - Color picker with palettes

### Technical
1. **Performance**
   - Optimize drawing with OffscreenCanvas
   - Use WebGL for rendering
   - Implement operation delta compression

2. **Protocol**
   - Binary WebSocket frames
   - Operation batching
   - Differential synchronization algorithm

3. **Architecture**
   - CRDT (Conflict-free Replicated Data Type) for true P2P
   - WebRTC for direct peer connections
   - Operational transformation for better conflict resolution

---

## Troubleshooting

### Common Issues

**Canvas not rendering:**
- Check browser console for errors
- Verify Canvas API support
- Ensure canvas element exists

**WebSocket connection fails:**
- Check server is running
- Verify port 3000 is accessible
- Check firewall settings
- Confirm WebSocket protocol (ws:// vs wss://)

**Drawing lag:**
- Reduce brush size
- Limit concurrent users
- Check network latency
- Monitor server CPU/memory

**Operations not syncing:**
- Check WebSocket connection status
- Verify operation message format
- Check server logs for errors
- Ensure operation IDs are unique

---

## Development Guidelines

### Code Style
- ES6+ JavaScript with modules
- Class-based architecture
- Descriptive variable/function names
- Comments for complex logic

### Git Workflow
- Feature branches: `feature/tool-name`
- Bug fixes: `fix/issue-description`
- Commit messages: Imperative mood, descriptive

### Adding New Features
1. Update architecture.md with design
2. Implement client-side changes
3. Update server message handlers
4. Test with multiple clients
5. Update documentation

### Debug Mode
Add debug flag to enable verbose logging:
```javascript
const DEBUG = true;
if (DEBUG) console.log('Operation:', operation);
```