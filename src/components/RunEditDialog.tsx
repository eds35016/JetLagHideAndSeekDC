import { useState, useEffect } from "react";
import { Edit3, Save, X } from "lucide-react";
import { toast } from "react-toastify";
import { useStore } from "@nanostores/react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { type TeamColor, type TeamRun, teamState } from "@/lib/context";
import { updateTeamRun } from "@/lib/team-updates";

const TEAM_COLORS: Record<TeamColor, string> = {
    green: "Green Team",
    yellow: "Yellow Team",
    blue: "Blue Team",
    red: "Red Team",
};

interface RunEditDialogProps {
    run: TeamRun;
    isOpen: boolean;
    onClose: () => void;
}

const formatDateTimeForInput = (timestamp: number): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const parseInputDateTime = (inputValue: string): number => {
    return new Date(inputValue).getTime();
};

export const RunEditDialog = ({ run, isOpen, onClose }: RunEditDialogProps) => {
    const $teamState = useStore(teamState);
    const [editedRun, setEditedRun] = useState({
        teamColor: run.teamColor,
        startTime: formatDateTimeForInput(run.startTime),
        endTime: run.endTime ? formatDateTimeForInput(run.endTime) : "",
    });
    const [isSaving, setIsSaving] = useState(false);

    // Check if this run is currently active
    const isActiveRun = run.id === $teamState.currentRunId && $teamState.isRunning;

    // Reset form when run changes
    useEffect(() => {
        setEditedRun({
            teamColor: run.teamColor,
            startTime: formatDateTimeForInput(run.startTime),
            endTime: run.endTime ? formatDateTimeForInput(run.endTime) : "",
        });
    }, [run]);

    const handleSave = async () => {
        setIsSaving(true);
        
        try {
            const startTime = parseInputDateTime(editedRun.startTime);
            const endTime = editedRun.endTime ? parseInputDateTime(editedRun.endTime) : null;
            const currentTime = Date.now();
            
            // Validate start time is not in the future
            if (startTime > currentTime) {
                toast.error("Start time cannot be in the future");
                setIsSaving(false);
                return;
            }
            
            // Validate times for completed runs
            if (endTime) {
                if (startTime >= endTime) {
                    toast.error("End time must be after start time");
                    setIsSaving(false);
                    return;
                }
                
                if (endTime > currentTime) {
                    toast.error("End time cannot be in the future");
                    setIsSaving(false);
                    return;
                }
            }
            
            const updateData: Partial<TeamRun> = {
                teamColor: editedRun.teamColor as TeamColor,
                startTime,
                endTime: endTime || undefined,
                duration: endTime ? endTime - startTime : undefined,
            };
            
            const success = await updateTeamRun(run.id, updateData);
            
            if (success) {
                toast.success("Run updated successfully");
                console.log('Run updated successfully, new start time:', startTime);
                onClose();
            } else {
                toast.error("Failed to update run");
            }
        } catch (error) {
            console.error("Error updating run:", error);
            toast.error("Error updating run");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        // Reset to original values
        setEditedRun({
            teamColor: run.teamColor,
            startTime: formatDateTimeForInput(run.startTime),
            endTime: run.endTime ? formatDateTimeForInput(run.endTime) : "",
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Edit3 className="w-5 h-5" />
                            <h2 className="text-lg font-semibold">Edit Run</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            className="p-1"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {/* Team Selection */}
                        <div>
                            <Label htmlFor="team-select">Team</Label>
                            <select
                                id="team-select"
                                value={editedRun.teamColor}
                                onChange={(e) => setEditedRun(prev => ({ ...prev, teamColor: e.target.value as TeamColor }))}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                title="Select team color"
                            >
                                {Object.entries(TEAM_COLORS).map(([color, name]) => (
                                    <option key={color} value={color}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Start Time */}
                        <div>
                            <Label htmlFor="start-time">Start Time</Label>
                            <input
                                id="start-time"
                                type="datetime-local"
                                step="1"
                                value={editedRun.startTime}
                                onChange={(e) => setEditedRun(prev => ({ ...prev, startTime: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                title="Set start time for the run"
                            />
                        </div>

                        {/* End Time */}
                        <div>
                            <Label htmlFor="end-time">End Time</Label>
                            <input
                                id="end-time"
                                type="datetime-local"
                                step="1"
                                value={editedRun.endTime}
                                onChange={(e) => setEditedRun(prev => ({ ...prev, endTime: e.target.value }))}
                                className={`w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${isActiveRun ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="Leave empty if run is still active"
                                disabled={isActiveRun}
                                title={isActiveRun ? "Cannot edit end time for active run" : "Set end time for the run"}
                            />
                            {isActiveRun && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    End time cannot be changed for the currently active run
                                </p>
                            )}
                        </div>

                        {/* Duration Display */}
                        {editedRun.startTime && editedRun.endTime && (
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                Duration: {Math.floor((parseInputDateTime(editedRun.endTime) - parseInputDateTime(editedRun.startTime)) / 1000 / 60)} minutes
                            </div>
                        )}

                        {/* Active Run Current Duration */}
                        {isActiveRun && editedRun.startTime && (
                            <div className="text-sm text-blue-600 dark:text-blue-400">
                                Current Duration: {Math.floor((Date.now() - parseInputDateTime(editedRun.startTime)) / 1000 / 60)} minutes
                            </div>
                        )}

                        {/* Validation Warning */}
                        {editedRun.startTime && parseInputDateTime(editedRun.startTime) > Date.now() && (
                            <div className="text-sm text-red-600 dark:text-red-400">
                                ⚠️ Start time cannot be in the future
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 mt-6">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};
