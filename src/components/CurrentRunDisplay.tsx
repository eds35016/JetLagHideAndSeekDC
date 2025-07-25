import { useStore } from "@nanostores/react";
import { Clock } from "lucide-react";
import { useState, useEffect } from "react";

import { teamState, enabledTeams, customTeamNames, type TeamColor } from "@/lib/context";

const TEAM_COLORS: Record<TeamColor, string> = {
    green: "bg-green-500 border-green-600",
    yellow: "bg-yellow-500 border-yellow-600",
    blue: "bg-blue-500 border-blue-600",
    red: "bg-red-500 border-red-600",
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

export const CurrentRunDisplay = () => {
    const $teamState = useStore(teamState);
    const $enabledTeams = useStore(enabledTeams);
    const $customTeamNames = useStore(customTeamNames);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Update current time every second for live timer display
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Don't show if no active team or team is disabled
    if (!$teamState.activeTeam || 
        !$teamState.isRunning || 
        !$teamState.currentRunStartTime ||
        !$enabledTeams[$teamState.activeTeam]) {
        return null;
    }

    const duration = currentTime - $teamState.currentRunStartTime;

    return (
        <div className={`
            backdrop-blur-sm rounded-lg border-2 shadow-lg p-2 min-w-[120px] ml-10
            ${TEAM_COLORS[$teamState.activeTeam]} bg-opacity-90 border-opacity-60 text-white
        `}>
            <div className="flex items-center gap-1.5 mb-0.5">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-medium opacity-90">ACTIVE</span>
            </div>
            <div className="text-sm font-semibold mb-0.5">
                {$customTeamNames[$teamState.activeTeam]}
            </div>
            <div className="text-base font-mono font-bold">
                {formatDuration(duration)}
            </div>
        </div>
    );
};
