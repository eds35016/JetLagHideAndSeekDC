import { WebSocketServer } from 'ws';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { parse } from 'url';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for SSL certificates
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global state (in production, you'd use a database)
let globalTeamState = {
    activeTeam: null,
    currentRunId: null,
    currentRunStartTime: null,
    isRunning: false,
    teamRuns: [],
};

// SSL certificate configuration
// You'll need to provide your own SSL certificates
const sslOptions = {
    // Uncomment and update these paths to your SSL certificate files
    // key: readFileSync(join(__dirname, 'ssl', 'private-key.pem')),
    // cert: readFileSync(join(__dirname, 'ssl', 'certificate.pem'))
    
    // For development/testing only - self-signed certificate
    // In production, use proper SSL certificates from a CA
    key: process.env.SSL_KEY || null,
    cert: process.env.SSL_CERT || null
};

// Create HTTPS server
const server = createServer(sslOptions);

// Create WebSocket server with SSL
const wss = new WebSocketServer({ 
    server,
    path: '/ws/teams'
});

// Broadcast to all connected clients
function broadcast(message) {
    const data = JSON.stringify(message);
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(data);
        }
    });
}

// WebSocket connection handler
wss.on('connection', (ws, request) => {
    console.log('New WebSocket Secure connection established');
    
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
        console.log('WebSocket Secure connection closed');
    });

    ws.on('error', (error) => {
        console.error('WebSocket Secure error:', error);
    });
});

function handleTeamRunStart(payload) {
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
    const newRun = {
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

function handleTeamRunStop(payload) {
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

    if (pathname?.startsWith('/api/teams/run/') && req.method === 'DELETE') {
        const runId = pathname.split('/').pop();
        const runIndex = globalTeamState.teamRuns.findIndex(run => run.id === runId);
        
        if (runIndex === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Run not found' }));
            return;
        }

        // If this is the currently active run, stop it first
        if (globalTeamState.currentRunId === runId) {
            globalTeamState.activeTeam = null;
            globalTeamState.currentRunId = null;
            globalTeamState.currentRunStartTime = null;
            globalTeamState.isRunning = false;
        }

        // Remove the run
        globalTeamState.teamRuns.splice(runIndex, 1);
        
        broadcast({
            type: 'team_state_sync',
            payload: globalTeamState
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, deletedRunId: runId }));
        return;
    }

    if (pathname?.startsWith('/api/teams/run/') && req.method === 'PUT') {
        const runId = pathname.split('/').pop();
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const updateData = JSON.parse(body);
                const runIndex = globalTeamState.teamRuns.findIndex(run => run.id === runId);
                
                if (runIndex === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Run not found' }));
                    return;
                }

                // Update the run with new data
                const updatedRun = { ...globalTeamState.teamRuns[runIndex], ...updateData };
                
                // Recalculate duration if start/end times changed
                if (updatedRun.startTime && updatedRun.endTime) {
                    updatedRun.duration = updatedRun.endTime - updatedRun.startTime;
                }
                
                globalTeamState.teamRuns[runIndex] = updatedRun;
                
                // If this is the currently active run and start time changed, update global state
                if (globalTeamState.currentRunId === runId && updateData.startTime !== undefined) {
                    globalTeamState.currentRunStartTime = updateData.startTime;
                    console.log(`Updated active run ${runId} start time to ${updateData.startTime}`);
                }
                
                broadcast({
                    type: 'team_state_sync',
                    payload: globalTeamState
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, updatedRun }));
                
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Health check
    if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', connections: wss.clients.size }));
        return;
    }

    // 404 for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Function to check SSL configuration
function checkSSLConfig() {
    if (!sslOptions.key || !sslOptions.cert) {
        console.warn('⚠️  SSL certificates not configured!');
        console.warn('For WSS (WebSocket Secure) to work properly, you need to:');
        console.warn('1. Generate SSL certificates');
        console.warn('2. Set SSL_KEY and SSL_CERT environment variables, or');
        console.warn('3. Update the sslOptions object with certificate file paths');
        console.warn('');
        console.warn('For development, you can generate self-signed certificates:');
        console.warn('openssl req -x509 -newkey rsa:4096 -keyout private-key.pem -out certificate.pem -days 365 -nodes');
        console.warn('');
        return false;
    }
    return true;
}

// Start the server
const PORT = process.env.PORT || 3443; // Default to 3443 for HTTPS
const hasSSL = checkSSLConfig();

if (hasSSL) {
    server.listen(PORT, () => {
        console.log(`Team WebSocket Secure server running on port ${PORT}`);
        console.log(`WebSocket Secure endpoint: wss://localhost:${PORT}/ws/teams`);
        console.log(`REST API available at: https://localhost:${PORT}/api/teams/`);
        console.log(`Health check: https://localhost:${PORT}/health`);
    });
} else {
    console.error('❌ Cannot start WSS server without SSL certificates');
    console.error('Please configure SSL certificates before running this server');
    process.exit(1);
}
