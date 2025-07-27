import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { parse } from 'url';
import { join } from 'path';

// Team state management
interface TeamRun {
    id: string;
    teamColor: 'green' | 'yellow' | 'blue' | 'red';
    startTime: number;
    endTime?: number;
    duration?: number;
}

interface TeamState {
    activeTeam: 'green' | 'yellow' | 'blue' | 'red' | null;
    currentRunId: string | null;
    currentRunStartTime: number | null;
    isRunning: boolean;
    teamRuns: TeamRun[];
}

// Global state (in production, you'd use a database)
let globalTeamState: TeamState = {
    activeTeam: null,
    currentRunId: null,
    currentRunStartTime: null,
    isRunning: false,
    teamRuns: [],
};

// SSL certificate configuration
// Note: For production, use proper SSL certificates from a CA
// For development, you can generate self-signed certificates:
// openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
const sslOptions = {
    key: readFileSync(process.env.SSL_KEY_PATH || join(process.cwd(), 'cert', 'key.pem')),
    cert: readFileSync(process.env.SSL_CERT_PATH || join(process.cwd(), 'cert', 'cert.pem'))
};

// Create HTTPS server
const server = createServer(sslOptions);

// Create WebSocket server with SSL
const wss = new WebSocketServer({ 
    server,
    path: '/ws/teams'
});

// Broadcast to all connected clients
function broadcast(message: any) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(data);
        }
    });
}

// WebSocket connection handler
wss.on('connection', (ws, request) => {
    console.log('New WSS connection established');
    
    // Send current state to new client
    ws.send(JSON.stringify({
        type: 'team_state_sync',
        payload: globalTeamState
    }));

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'team_run_start':
                    handleTeamRunStart(message.payload);
                    break;
                case 'team_run_stop':
                    handleTeamRunStop(message.payload);
                    break;
                case 'get_team_state':
                    ws.send(JSON.stringify({
                        type: 'team_state_sync',
                        payload: globalTeamState
                    }));
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        console.log('WSS connection closed');
    });

    ws.on('error', (error) => {
        console.error('WSS error:', error);
    });
});

function handleTeamRunStart(payload: any) {
    const { team, runId, startTime } = payload;
    
    // Validate input
    if (!team || !runId || !startTime) {
        console.error('Invalid team run start payload:', payload);
        return;
    }

    // Stop any existing run
    if (globalTeamState.isRunning && globalTeamState.currentRunId) {
        const endTime = Date.now();
        const currentRun = globalTeamState.teamRuns.find(run => run.id === globalTeamState.currentRunId);
        if (currentRun && !currentRun.endTime) {
            currentRun.endTime = endTime;
            currentRun.duration = endTime - currentRun.startTime;
        }
    }

    // Create new run
    const newRun: TeamRun = {
        id: runId,
        teamColor: team,
        startTime: startTime,
    };

    // Update global state
    globalTeamState = {
        ...globalTeamState,
        activeTeam: team,
        currentRunId: runId,
        currentRunStartTime: startTime,
        isRunning: true,
        teamRuns: [...globalTeamState.teamRuns, newRun],
    };

    // Broadcast to all clients
    broadcast({
        type: 'team_run_started',
        payload: {
            activeTeam: team,
            currentRunId: runId,
            currentRunStartTime: startTime,
            isRunning: true,
            newRun: newRun,
            teamState: globalTeamState
        }
    });

    console.log(`Started run for team ${team} with ID ${runId}`);
}

function handleTeamRunStop(payload: any) {
    const { runId, endTime } = payload;
    
    if (!runId || !endTime) {
        console.error('Invalid team run stop payload:', payload);
        return;
    }

    // Find and update the run
    const runIndex = globalTeamState.teamRuns.findIndex(run => run.id === runId);
    if (runIndex === -1) {
        console.error('Run not found:', runId);
        return;
    }

    const run = globalTeamState.teamRuns[runIndex];
    const duration = endTime - run.startTime;
    
    // Update the run
    globalTeamState.teamRuns[runIndex] = {
        ...run,
        endTime: endTime,
        duration: duration,
    };

    // Update global state
    globalTeamState = {
        ...globalTeamState,
        activeTeam: null,
        currentRunId: null,
        currentRunStartTime: null,
        isRunning: false,
    };

    // Broadcast to all clients
    broadcast({
        type: 'team_run_stopped',
        payload: {
            runId: runId,
            endTime: endTime,
            duration: duration,
            updatedRun: globalTeamState.teamRuns[runIndex],
            teamState: globalTeamState
        }
    });

    console.log(`Stopped run ${runId} with duration ${duration}ms`);
}

// HTTPS endpoints for REST API
server.on('request', (req, res) => {
    const { pathname } = parse(req.url || '', true);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (pathname === '/api/teams/state' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(globalTeamState));
        return;
    }

    if (pathname === '/api/teams/start' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                handleTeamRunStart(payload);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, state: globalTeamState }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (pathname === '/api/teams/stop' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                handleTeamRunStop(payload);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, state: globalTeamState }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    if (pathname === '/api/teams/clear' && req.method === 'POST') {
        globalTeamState = {
            activeTeam: null,
            currentRunId: null,
            currentRunStartTime: null,
            isRunning: false,
            teamRuns: [],
        };
        
        broadcast({
            type: 'team_state_sync',
            payload: globalTeamState
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state: globalTeamState }));
        return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Start the secure server
const PORT = process.env.PORT || 3443; // Use 3443 for HTTPS by default
server.listen(PORT, () => {
    console.log(`Team WSS server running on port ${PORT}`);
    console.log(`WebSocket Secure endpoint: wss://localhost:${PORT}/ws/teams`);
    console.log(`REST API available at: https://localhost:${PORT}/api/teams/`);
});

export default server;
