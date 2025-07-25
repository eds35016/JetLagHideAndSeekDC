import { useStore } from "@nanostores/react";
import { Play, Square, Timer, Edit3, Trash2, RotateCcw, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RunEditDialog } from "@/components/RunEditDialog";
import { selectedTimerTeam, teamState, enabledTeams, customTeamNames, type TeamColor, type TeamRun } from "@/lib/context";
import { broadcastTeamRunStart, broadcastTeamRunStop, teamUpdateService, deleteTeamRun, clearAllTeamRuns } from "@/lib/team-updates";

const TEAM_COLORS: Record<TeamColor, string> = {
    green: "bg-green-500 hover:bg-green-600 text-white",
    yellow: "bg-yellow-500 hover:bg-yellow-600 text-white",
    blue: "bg-blue-500 hover:bg-blue-600 text-white",
    red: "bg-red-500 hover:bg-red-600 text-white",
};

const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const TimerControlPanel = () => {
    const $teamState = useStore(teamState);
    const $selectedTeam = useStore(selectedTimerTeam);
    const $enabledTeams = useStore(enabledTeams);
    const $customTeamNames = useStore(customTeamNames);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [editingRun, setEditingRun] = useState<TeamRun | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Update current time every second for live timer display
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Update current time immediately when team state changes (for real-time updates)
    useEffect(() => {
        setCurrentTime(Date.now());
    }, [$teamState.currentRunStartTime, $teamState.activeTeam, $teamState.isRunning]);

    // Calculate the current duration reactively
    const currentDuration = useMemo(() => {
        if ($teamState.isRunning && $teamState.currentRunStartTime) {
            return currentTime - $teamState.currentRunStartTime;
        }
        return 0;
    }, [currentTime, $teamState.currentRunStartTime, $teamState.isRunning]);

    // Initialize team update service when component mounts
    useEffect(() => {
        console.log('TimerControlPanel: Initializing team update service');
        // The service is already initialized as a singleton
    }, []);

    const startRun = () => {
        if (!$selectedTeam) {
            toast.error("Please select a team first");
            return;
        }

        if ($teamState.isRunning) {
            toast.error("A run is already in progress");
            return;
        }

        const runId = `${$selectedTeam}-${Date.now()}`;
        const startTime = Date.now();

        // Broadcast the update to all clients
        broadcastTeamRunStart($selectedTeam, runId, startTime);

        toast.success(`Started run for ${$customTeamNames[$selectedTeam]}`);
    };

    const stopRun = () => {
        if (!$teamState.isRunning || !$teamState.currentRunId || !$teamState.currentRunStartTime) {
            toast.error("No run is currently active");
            return;
        }

        const endTime = Date.now();
        const duration = endTime - $teamState.currentRunStartTime;

        // Broadcast the update to all clients
        broadcastTeamRunStop($teamState.currentRunId, endTime);

        toast.success(`Stopped run - Duration: ${formatDuration(duration)}`);
    };

    const handleEditRun = (run: TeamRun) => {
        setEditingRun(run);
    };

    const handleDeleteRun = async (run: TeamRun) => {
        if (confirm(`Are you sure you want to delete the ${$customTeamNames[run.teamColor]} run?`)) {
            const success = await deleteTeamRun(run.id);
            if (success) {
                toast.success("Run deleted successfully");
            } else {
                toast.error("Failed to delete run");
            }
        }
    };

    const handleClearAllRuns = async () => {
        if ($teamState.isRunning) {
            toast.error("Cannot clear runs while a timer is active");
            return;
        }
        
        const success = await clearAllTeamRuns();
        if (success) {
            toast.success("All runs cleared successfully");
            setShowClearConfirm(false);
        } else {
            toast.error("Failed to clear runs");
        }
    };

    const updateTeamName = (team: TeamColor, newName: string) => {
        const newTeamNames = { ...$customTeamNames, [team]: newName };
        customTeamNames.set(newTeamNames);
    };

    const resetTeamNames = () => {
        const defaultNames: Record<TeamColor, string> = {
            green: "Green Team",
            yellow: "Yellow Team",
            blue: "Blue Team",
            red: "Red Team",
        };
        customTeamNames.set(defaultNames);
        toast.success("Team names reset to defaults");
    };

    const toggleTeamEnabled = (team: TeamColor) => {
        // Prevent disabling a team that has an active run
        if ($enabledTeams[team] && $teamState.isRunning && $teamState.activeTeam === team) {
            toast.error(`Cannot disable ${$customTeamNames[team]} - they have an active run. Stop the timer first.`);
            return;
        }

        const newEnabledTeams = { ...$enabledTeams, [team]: !$enabledTeams[team] };
        enabledTeams.set(newEnabledTeams);
        
        // If disabling the currently selected team, deselect it
        if (!newEnabledTeams[team] && $selectedTeam === team) {
            selectedTimerTeam.set(null);
        }
        
        toast.info(`${$customTeamNames[team]} ${newEnabledTeams[team] ? 'enabled' : 'disabled'} for players`);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 mb-6">
                <Timer className="w-6 h-6" />
                <h1 className="text-2xl font-bold">Timer Control</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Controls */}
                <div className="space-y-6">
                    {/* Current Status */}
                    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                        <h2 className="text-lg font-semibold mb-2">Current Status</h2>
                        {$teamState.isRunning && $teamState.activeTeam && $teamState.currentRunStartTime ? (
                            <div>
                                <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${TEAM_COLORS[$teamState.activeTeam]}`}>
                                    {$customTeamNames[$teamState.activeTeam]}
                                </div>
                                <div className="text-2xl font-mono">
                                    {formatDuration(currentDuration)}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Started: {new Date($teamState.currentRunStartTime).toLocaleTimeString()}
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-600 dark:text-gray-400">
                                No active run
                            </div>
                        )}
                    </div>

                    {/* Team Selection */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3">Select Team for Timer</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(TEAM_COLORS) as TeamColor[])
                                .filter(team => $enabledTeams[team])
                                .map(team => (
                                <Button
                                    key={team}
                                    variant={$selectedTeam === team ? "default" : "outline"}
                                    className={`
                                        h-12 font-semibold transition-all
                                        ${$selectedTeam === team ? TEAM_COLORS[team] : ''}
                                    `}
                                    onClick={() => selectedTimerTeam.set(team === $selectedTeam ? null : team)}
                                >
                                    {$customTeamNames[team]}
                                </Button>
                            ))}
                        </div>
                        {(Object.keys(TEAM_COLORS) as TeamColor[]).filter(team => $enabledTeams[team]).length === 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                No teams are currently enabled. Enable teams in the visibility section below.
                            </p>
                        )}
                    </div>

                    {/* Team Visibility Controls */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3">Team Visibility (for Players)</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Control which teams are visible to players in the team sidebar
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(TEAM_COLORS) as TeamColor[]).map(team => {
                                const hasActiveRun = $teamState.isRunning && $teamState.activeTeam === team;
                                const cannotDisable = $enabledTeams[team] && hasActiveRun;
                                
                                return (
                                    <Button
                                        key={team}
                                        variant="outline"
                                        className={`
                                            h-12 font-semibold transition-all flex items-center justify-center gap-2
                                            ${$enabledTeams[team] 
                                                ? TEAM_COLORS[team] 
                                                : 'bg-gray-200 hover:bg-gray-300 text-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-400'
                                            }
                                            ${cannotDisable ? 'cursor-not-allowed opacity-75' : ''}
                                        `}
                                        onClick={() => toggleTeamEnabled(team)}
                                        disabled={cannotDisable}
                                        title={cannotDisable ? `Cannot disable ${$customTeamNames[team]} - they have an active run` : ''}
                                    >
                                        {$enabledTeams[team] ? (
                                            <Eye className="w-4 h-4" />
                                        ) : (
                                            <EyeOff className="w-4 h-4" />
                                        )}
                                        {$customTeamNames[team]}
                                        {hasActiveRun && (
                                            <span className="ml-1 text-xs bg-green-200 text-green-800 px-1 rounded">
                                                ACTIVE
                                            </span>
                                        )}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Team Names Configuration */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">Team Names</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={resetTeamNames}
                                className="text-white hover:text-white"
                            >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Reset to Defaults
                            </Button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Customize team names that will appear throughout the application
                        </p>
                        <div className="space-y-3">
                            {(Object.keys(TEAM_COLORS) as TeamColor[]).map(team => (
                                <div key={team} className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded ${team === 'green' ? 'bg-green-500' : team === 'yellow' ? 'bg-yellow-500' : team === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`} />
                                    <Input
                                        value={$customTeamNames[team]}
                                        onChange={(e) => updateTeamName(team, e.target.value)}
                                        className="flex-1"
                                        placeholder={`${team.charAt(0).toUpperCase() + team.slice(1)} Team`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Control Buttons */}
                    <div className="flex gap-4">
                        <Button
                            onClick={startRun}
                            disabled={$teamState.isRunning || !$selectedTeam}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Start Run
                        </Button>
                        
                        <Button
                            onClick={stopRun}
                            disabled={!$teamState.isRunning}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                            <Square className="w-4 h-4 mr-2" />
                            Stop Run
                        </Button>
                    </div>
                </div>

                {/* Right Column - Recent Runs */}
                <div className="space-y-6">
                    {$teamState.teamRuns.length > 0 ? (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold">Recent Runs</h3>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowClearConfirm(true)}
                                        disabled={$teamState.isRunning}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        <RotateCcw className="w-4 h-4 mr-1" />
                                        Clear All
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {$teamState.teamRuns
                                    .slice(-15)
                                    .reverse()
                                    .map(run => (
                                        <div key={run.id} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-sm font-semibold ${run.teamColor === 'green' ? 'text-green-600' : run.teamColor === 'yellow' ? 'text-yellow-600' : run.teamColor === 'blue' ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {$customTeamNames[run.teamColor]}
                                                    </span>
                                                    {run.id === $teamState.currentRunId && (
                                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm font-mono">
                                                    {run.duration ? formatDuration(run.duration) : 
                                                     (run.id === $teamState.currentRunId && $teamState.currentRunStartTime ? 
                                                      formatDuration(currentTime - $teamState.currentRunStartTime) : 
                                                      'Running...')}
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(run.startTime).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 ml-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditRun(run)}
                                                    className="p-1 h-8 w-8 hover:bg-blue-100 dark:hover:bg-blue-900/20"
                                                    title="Edit run"
                                                >
                                                    <Edit3 className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteRun(run)}
                                                    className="p-1 h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900/20"
                                                    title="Delete run"
                                                    disabled={run.id === $teamState.currentRunId}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-600 dark:text-gray-400 py-8">
                            <Timer className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No runs yet</p>
                            <p className="text-sm">Start a timer to see run history here</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Clear All Confirmation Dialog */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            <h3 className="text-lg font-semibold">Clear All Runs</h3>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Are you sure you want to delete all run history? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                onClick={handleClearAllRuns}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                Clear All
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowClearConfirm(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Run Dialog */}
            {editingRun && (
                <RunEditDialog
                    run={editingRun}
                    isOpen={!!editingRun}
                    onClose={() => setEditingRun(null)}
                />
            )}
        </div>
    );
};
