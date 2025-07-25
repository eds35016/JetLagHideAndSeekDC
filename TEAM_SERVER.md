# Team Timer Server Setup

This project includes a comprehensive WebSocket server for real-time team timer synchronization across multiple clients with advanced features like automatic hider mode integration, CRUD operations, and persistent team selections.

## Running the Full Application

### Option 1: Run everything together
```bash
npm install
npm run dev:full
```

This will start both the Astro development server (port 4321) and the team WebSocket server (port 3001).

### Option 2: Run separately
```bash
# Terminal 1: Start the team server
npm run dev:team-server

# Terminal 2: Start the Astro dev server
npm run dev
```

## Server Endpoints

### WebSocket
- **URL**: `ws://localhost:3001/ws/teams`
- **Purpose**: Real-time team state synchronization

### REST API
- **GET** `/api/teams/state` - Get current team state
- **PUT** `/api/teams/runs/:id` - Update an existing team run
- **DELETE** `/api/teams/runs/:id` - Delete a team run
- **POST** `/api/teams/clear` - Clear all team data
- **GET** `/health` - Health check

## Features

### Team Sidebar
- Switch between Questions and Teams view using the Users icon in the sidebar
- View real-time run history for each team (Green, Yellow, Blue, Red)
- Current longest run is highlighted with a gold outline
- Live timer display for active runs
- Team selection buttons at the bottom with persistent state
- **Automatic Hider Mode Integration**:
  - Auto-enables hider mode when selected team starts a run
  - Auto-enables when selecting a team with an active run
  - Auto-disables when selected team's run ends
  - Auto-disables when switching to a team without an active run
  - Provides toast notifications for all automatic mode changes

### Timer Control Panel
- Accessible via the "Timer" button (only visible when Developer Mode is enabled)
- Opens in a new tab for separate control with independent team selection
- Start/stop runs for selected teams
- Real-time synchronization with all connected clients
- Shows current active team and elapsed time
- **Advanced Run Management**:
  - Edit existing runs (start time, end time, team)
  - Delete individual runs with confirmation
  - Clear all runs with confirmation dialog
  - Disabled end time editing for active runs
  - Reactive timer updates when start time changes
- **Enhanced UI**:
  - Recent runs display (last 10, most recent first)
  - Live timer display for active runs in run history
  - Edit and delete buttons for each run
  - Visual indicators for active runs
  - Persistent team selection across page refreshes

### Persistent State Management
- **Team Selection**: Both main app and timer control panel remember selected teams separately
- **Auto-save Integration**: Works seamlessly with existing auto-save functionality
- **localStorage**: Selected teams persist across browser sessions and page refreshes

### Developer Features
- Timer control panel hidden unless Developer Mode is enabled
- Clean UI for regular users while maintaining full functionality for developers

### Testing Features
- Sample team data functionality has been removed (cleaned up)
- Clear all data button available in Timer Control Panel
- Real-time testing across multiple browser tabs/windows
- All CRUD operations work seamlessly with server synchronization

## Technical Implementation

### Client-Side Architecture
- **State Management**: Uses nanostores with persistent atoms for team selections
- **Real-time Updates**: WebSocket client with automatic reconnection
- **Reactive Timers**: useMemo and useEffect for live duration calculations
- **Separate State**: Independent team selections for main app vs timer control
- **Error Handling**: Graceful fallbacks and user feedback via toast notifications

### Server-Side Architecture
- **WebSocket Server**: Node.js with `ws` library on port 3001
- **In-Memory Storage**: Team state maintained in server memory
- **REST API**: Express-like HTTP endpoints for CRUD operations
- **Broadcast System**: Real-time updates to all connected clients
- **CORS Enabled**: Cross-origin requests supported for development

### Data Models
```typescript
interface TeamRun {
    id: string;                    // Unique identifier
    teamColor: TeamColor;          // 'green' | 'yellow' | 'blue' | 'red'
    startTime: number;             // Unix timestamp
    endTime?: number;              // Unix timestamp (optional for active runs)
    duration?: number;             // Milliseconds (calculated when run ends)
}

interface TeamState {
    activeTeam: TeamColor | null;          // Currently running team
    currentRunId: string | null;           // ID of active run
    currentRunStartTime: number | null;    // Start time of active run
    isRunning: boolean;                    // Whether any run is active
    teamRuns: TeamRun[];                   // Complete run history
}
```

## How It Works

1. **WebSocket Connection**: Clients automatically connect to the team server on component mount
2. **Real-time Updates**: All timer actions broadcast to connected clients immediately
3. **Persistent State**: Team selections saved to localStorage and restored on page load
4. **Automatic Integration**: Hider mode automatically follows selected team's run status
5. **CRUD Operations**: Full create, read, update, delete support with real-time sync
6. **Fallback Handling**: Graceful degradation if server is unavailable
7. **State Synchronization**: Server maintains authoritative state, clients reflect changes

## Usage Scenarios

### Basic Timer Operation
1. Enable Developer Mode in Options
2. Click Timer button to open control panel
3. Select a team in the timer control panel
4. Start a run - all clients see the update immediately
5. Stop the run - duration calculated and broadcast

### Hider Mode Integration
1. Select a team in the main application's team sidebar
2. When that team starts a run, hider mode automatically enables
3. When switching to a different team without an active run, hider mode disables
4. All changes provide user feedback via toast notifications

### Run Management
1. View run history in both team sidebar and timer control panel
2. Edit past runs using the edit button (pencil icon)
3. Delete runs using the delete button (trash icon)
4. Clear all runs using the "Clear All" button with confirmation

## Production Deployment

For production, consider:
1. **Database Integration**: Replace in-memory storage with persistent database
2. **Authentication**: Add user authentication and authorization
3. **Security**: Implement proper CORS policies and input validation
4. **Scaling**: Use Redis for state management across multiple server instances
5. **Monitoring**: Add logging, metrics, and health monitoring
6. **Environment Config**: Use environment variables for all configuration
7. **HTTPS**: Secure WebSocket connections (wss://) for production

