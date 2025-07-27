import { teamState, enabledTeams, customTeamNames, type TeamColor, type TeamRun } from "@/lib/context";

export interface TeamUpdateMessage {
    type: 'team_run_started' | 'team_run_stopped' | 'team_state_update' | 'team_state_sync' | 'team_config_updated';
    payload: {
        activeTeam?: TeamColor | null;
        currentRunId?: string | null;
        currentRunStartTime?: number | null;
        isRunning?: boolean;
        newRun?: TeamRun;
        updatedRun?: TeamRun;
        teamRuns?: TeamRun[];
        teamState?: any;
        teamConfig?: {
            enabledTeams?: Record<TeamColor, boolean>;
            customTeamNames?: Record<TeamColor, string>;
        };
        configType?: string;
    };
}

class TeamUpdateService {
    private websocket: WebSocket | null = null;
    private isConnected = false;
    private reconnectInterval = 5000;
    private maxReconnectAttempts = 5;
    private reconnectAttempts = 0;
    private baseUrl: string;

    constructor() {
        // Determine the base URL for WebSocket connection
        this.baseUrl = this.getWebSocketUrl();
        this.connect();
    }

    private getWebSocketUrl(): string {
        if (typeof window === 'undefined') return '';
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        
        // In development, use port 3001 for the team server
        if (host === 'localhost' || host === '127.0.0.1') {
            return `${protocol}//${host}:3001/ws/teams`;
        }
        
        // In production, you might want to use the same port as your main server
        return `${protocol}//${host}:${window.location.port}/ws/teams`;
    }

    private connect() {
        if (typeof window === 'undefined') {
            console.log('WebSocket not available in server environment');
            return;
        }

        try {
            console.log('Attempting to connect to:', this.baseUrl);
            this.websocket = new WebSocket(this.baseUrl);
            
            this.websocket.onopen = () => {
                console.log('Connected to team WebSocket server');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Request current state
                this.websocket?.send(JSON.stringify({
                    type: 'get_team_state'
                }));
            };

            this.websocket.onmessage = (event) => {
                try {
                    const update: TeamUpdateMessage = JSON.parse(event.data);
                    this.handleUpdate(update);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                this.websocket = null;
                this.handleReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Failed to connect to team WebSocket server:', error);
            this.handleReconnect();
        }
    }

    private handleUpdate(update: TeamUpdateMessage) {
        console.log('Received WebSocket update:', update);
        const currentState = teamState.get();
        
        switch (update.type) {
            case 'team_state_sync':
                console.log('Syncing team state:', update.payload.teamState || update.payload);
                // Full state sync from server
                if (update.payload.teamState) {
                    teamState.set(update.payload.teamState);
                } else {
                    teamState.set({
                        activeTeam: update.payload.activeTeam ?? null,
                        currentRunId: update.payload.currentRunId ?? null,
                        currentRunStartTime: update.payload.currentRunStartTime ?? null,
                        isRunning: update.payload.isRunning ?? false,
                        teamRuns: update.payload.teamRuns ?? [],
                    });
                }
                
                // Sync team configuration if provided
                if (update.payload.teamConfig) {
                    if (update.payload.teamConfig.enabledTeams) {
                        enabledTeams.set(update.payload.teamConfig.enabledTeams);
                    }
                    if (update.payload.teamConfig.customTeamNames) {
                        customTeamNames.set(update.payload.teamConfig.customTeamNames);
                    }
                }
                break;
                
            case 'team_config_updated':
                console.log('Team config updated:', update.payload);
                if (update.payload.teamConfig) {
                    if (update.payload.teamConfig.enabledTeams) {
                        enabledTeams.set(update.payload.teamConfig.enabledTeams);
                    }
                    if (update.payload.teamConfig.customTeamNames) {
                        customTeamNames.set(update.payload.teamConfig.customTeamNames);
                    }
                }
                break;
                
            case 'team_run_started':
                console.log('Team run started:', update.payload);
                if (update.payload.teamState) {
                    teamState.set(update.payload.teamState);
                } else if (update.payload.newRun) {
                    teamState.set({
                        ...currentState,
                        activeTeam: update.payload.activeTeam || currentState.activeTeam,
                        currentRunId: update.payload.currentRunId || currentState.currentRunId,
                        currentRunStartTime: update.payload.currentRunStartTime || currentState.currentRunStartTime,
                        isRunning: update.payload.isRunning ?? currentState.isRunning,
                        teamRuns: [...currentState.teamRuns, update.payload.newRun],
                    });
                }
                break;
                
            case 'team_run_stopped':
                console.log('Team run stopped:', update.payload);
                if (update.payload.teamState) {
                    teamState.set(update.payload.teamState);
                } else if (update.payload.updatedRun) {
                    const updatedRuns = currentState.teamRuns.map(run =>
                        run.id === update.payload.updatedRun!.id ? update.payload.updatedRun! : run
                    );
                    
                    teamState.set({
                        ...currentState,
                        activeTeam: update.payload.activeTeam ?? currentState.activeTeam,
                        currentRunId: update.payload.currentRunId ?? currentState.currentRunId,
                        currentRunStartTime: update.payload.currentRunStartTime ?? currentState.currentRunStartTime,
                        isRunning: update.payload.isRunning ?? currentState.isRunning,
                        teamRuns: updatedRuns,
                    });
                }
                break;
                
            case 'team_state_update':
                console.log('Team state update:', update.payload);
                teamState.set({
                    ...currentState,
                    ...update.payload,
                    teamRuns: update.payload.teamRuns || currentState.teamRuns,
                });
                break;
        }
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    // Send updates to server via WebSocket
    public broadcastUpdate(update: any) {
        console.log('Broadcasting update:', update);
        if (this.websocket && this.isConnected) {
            this.websocket.send(JSON.stringify(update));
            console.log('Update sent via WebSocket');
        } else {
            console.warn('WebSocket not connected, cannot send update. Connection state:', {
                websocket: !!this.websocket,
                isConnected: this.isConnected,
                readyState: this.websocket?.readyState
            });
        }
    }

    public disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
    }
}

// Create singleton instance
export const teamUpdateService = new TeamUpdateService();

// Helper functions to broadcast updates
export const broadcastTeamRunStart = (team: TeamColor, runId: string, startTime: number) => {
    teamUpdateService.broadcastUpdate({
        type: 'team_run_start',
        payload: {
            team,
            runId,
            startTime,
        }
    });
};

export const broadcastTeamRunStop = (runId: string, endTime: number) => {
    teamUpdateService.broadcastUpdate({
        type: 'team_run_stop',
        payload: {
            runId,
            endTime,
        }
    });
};

// Helper functions for run management
export const deleteTeamRun = async (runId: string): Promise<boolean> => {
    try {
        const response = await fetch(`http://localhost:3001/api/teams/run/${runId}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            console.log(`Successfully deleted run ${runId}`);
            return true;
        } else {
            console.error('Failed to delete run:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Error deleting run:', error);
        return false;
    }
};

export const updateTeamRun = async (runId: string, updateData: Partial<TeamRun>): Promise<boolean> => {
    try {
        const response = await fetch(`http://localhost:3001/api/teams/run/${runId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });
        
        if (response.ok) {
            console.log(`Successfully updated run ${runId}`);
            return true;
        } else {
            console.error('Failed to update run:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Error updating run:', error);
        return false;
    }
};

export const clearAllTeamRuns = async (): Promise<boolean> => {
    try {
        const response = await fetch('http://localhost:3001/api/teams/clear', {
            method: 'POST',
        });
        
        if (response.ok) {
            console.log('Successfully cleared all runs');
            return true;
        } else {
            console.error('Failed to clear runs:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Error clearing runs:', error);
        return false;
    }
};

// Helper functions to broadcast team configuration updates
export const broadcastEnabledTeamsUpdate = (enabledTeamsData: Record<TeamColor, boolean>) => {
    teamUpdateService.broadcastUpdate({
        type: 'team_config_update',
        payload: {
            type: 'enabledTeams',
            data: enabledTeamsData,
        }
    });
};

export const broadcastCustomTeamNamesUpdate = (customTeamNamesData: Record<TeamColor, string>) => {
    teamUpdateService.broadcastUpdate({
        type: 'team_config_update',
        payload: {
            type: 'customTeamNames',
            data: customTeamNamesData,
        }
    });
};
