import { useStore } from "@nanostores/react";
import { Clock, Users, SidebarCloseIcon } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "react-toastify";

import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar-l";
import { TeamSidebar as TeamSidebarContainer, TeamSidebarContext } from "@/components/ui/team-sidebar";
import { selectedTeam, teamState, hiderMode, enabledTeams, customTeamNames, type TeamColor } from "@/lib/context";
import { teamUpdateService } from "@/lib/team-updates";

const TEAM_COLORS: Record<TeamColor, string> = {
    green: "bg-green-500 hover:bg-green-600 border-green-600",
    yellow: "bg-yellow-500 hover:bg-yellow-600 border-yellow-600",
    blue: "bg-blue-500 hover:bg-blue-600 border-blue-600",
    red: "bg-red-500 hover:bg-red-600 border-red-600",
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

const TeamRunItem = ({ run, isLongest, currentTime, customTeamNames }: { 
    run: { id: string; teamColor: TeamColor; startTime: number; endTime?: number; duration?: number }; 
    isLongest: boolean; 
    currentTime: number;
    customTeamNames: Record<TeamColor, string>;
}) => {
    const duration = run.duration || (run.endTime ? run.endTime - run.startTime : currentTime - run.startTime);
    
    return (
        <div
            className={`
                p-3 rounded-lg border-2 transition-all ml-4
                ${TEAM_COLORS[run.teamColor]}
                ${isLongest ? 'ring-2 ring-yellow-400 shadow-lg' : ''}
            `}
        >
            <div className="text-white font-semibold text-sm">
                {customTeamNames[run.teamColor]}
            </div>
            <div className="text-white/90 text-lg font-mono">
                {formatDuration(duration)}
            </div>
            {!run.endTime && (
                <div className="text-white/80 text-xs flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Running...
                </div>
            )}
        </div>
    );
};

export const TeamSidebar = () => {
    const $teamState = useStore(teamState);
    const $selectedTeam = useStore(selectedTeam);
    const $enabledTeams = useStore(enabledTeams);
    const $customTeamNames = useStore(customTeamNames);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [previousActiveTeam, setPreviousActiveTeam] = useState<TeamColor | null>(null);
    const [previousRunning, setPreviousRunning] = useState(false);

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
    }, [$teamState.currentRunStartTime, $teamState.activeTeam, $teamState.isRunning, $teamState.teamRuns]);

    // Automatic hider mode management based on selected team's active run status
    useEffect(() => {
        if (!$selectedTeam) return;

        const selectedTeamHasActiveRun = $teamState.isRunning && $teamState.activeTeam === $selectedTeam;
        const selectedTeamHadActiveRun = previousRunning && previousActiveTeam === $selectedTeam;
        const $hiderMode = hiderMode.get();
        
        // Enable hider mode when selected team starts a run
        if (selectedTeamHasActiveRun && !selectedTeamHadActiveRun) {
            if ($hiderMode === false) {
                console.log(`Auto-enabling hider mode for ${$selectedTeam} team (run started)`);
                // Set a default location (Washington DC center) - user can adjust later
                hiderMode.set({
                    latitude: 38.9072,
                    longitude: -77.0369
                });
                toast.info(`Hider mode enabled automatically for ${$customTeamNames[$selectedTeam]} run`);
            }
        }
        
        // Disable hider mode when selected team's run ends
        if (!selectedTeamHasActiveRun && selectedTeamHadActiveRun) {
            if ($hiderMode !== false) {
                console.log(`Auto-disabling hider mode for ${$selectedTeam} team (run ended)`);
                hiderMode.set(false);
                toast.info(`Hider mode disabled - ${$customTeamNames[$selectedTeam]} run ended`);
            }
        }

        // Update tracking state
        setPreviousActiveTeam($teamState.activeTeam);
        setPreviousRunning($teamState.isRunning);
    }, [$selectedTeam, $teamState.isRunning, $teamState.activeTeam]);

    // Handle case where user selects a team that already has an active run
    useEffect(() => {
        if (!$selectedTeam) return;
        
        const selectedTeamHasActiveRun = $teamState.isRunning && $teamState.activeTeam === $selectedTeam;
        const $hiderMode = hiderMode.get();
        
        if (selectedTeamHasActiveRun && $hiderMode === false) {
            console.log(`Auto-enabling hider mode for ${$selectedTeam} team (team selected with active run)`);
            hiderMode.set({
                latitude: 38.9072,
                longitude: -77.0369
            });
            toast.info(`Hider mode enabled automatically - ${$customTeamNames[$selectedTeam]} has an active run`);
        }
        
        // Disable hider mode when switching to a team that doesn't have an active run
        if (!selectedTeamHasActiveRun && $hiderMode !== false) {
            console.log(`Auto-disabling hider mode for ${$selectedTeam} team (no active run)`);
            hiderMode.set(false);
            toast.info(`Hider mode disabled - ${$customTeamNames[$selectedTeam]} has no active run`);
        }
    }, [$selectedTeam]); // Only trigger when selected team changes

    // Initialize team update service when component mounts
    useEffect(() => {
        // The service is already initialized as a singleton, but this ensures it's active
        console.log('TeamSidebar: Initializing team update service');
        
        // Cleanup function to disconnect when component unmounts
        return () => {
            // Don't disconnect here as other components might be using it
        };
    }, []);

    // Calculate longest run
    const longestRun = useMemo(() => {
        if ($teamState.teamRuns.length === 0) return null;
        
        return $teamState.teamRuns.reduce((longest, current) => {
            const currentDuration = current.duration || (current.endTime ? current.endTime - current.startTime : currentTime - current.startTime);
            const longestDuration = longest.duration || (longest.endTime ? longest.endTime - longest.startTime : currentTime - longest.startTime);
            
            return currentDuration > longestDuration ? current : longest;
        });
    }, [$teamState.teamRuns, currentTime]);

    // Sort all runs by duration (longest first), filter by enabled teams
    const rankedRuns = useMemo(() => {
        return $teamState.teamRuns
            .filter(run => $enabledTeams[run.teamColor])
            .map(run => ({
                ...run,
                calculatedDuration: run.duration || (run.endTime ? run.endTime - run.startTime : currentTime - run.startTime)
            }))
            .sort((a, b) => b.calculatedDuration - a.calculatedDuration);
    }, [$teamState.teamRuns, currentTime, $enabledTeams]);

    const handleTeamSelect = (team: TeamColor) => {
        selectedTeam.set(team === $selectedTeam ? null : team);
    };

    return (
        <TeamSidebarContainer>
            <div className="flex items-center justify-between">
                <h2 className="ml-4 mt-4 font-poppins text-2xl flex items-center gap-2">
                    <Users className="w-6 h-6" />
                    Teams
                </h2>
                <div className="flex items-center gap-2 mr-2">
                    <SidebarCloseIcon
                        className="visible md:hidden"
                        onClick={() => {
                            TeamSidebarContext.get().setOpenMobile(false);
                        }}
                    />
                </div>
            </div>
            
            <SidebarContent className="px-4">
                {/* Current active team indicator */}
                {$teamState.activeTeam && $enabledTeams[$teamState.activeTeam] && (
                    <div className="mt-2 mb-4 p-3 bg-gray-800 rounded-lg">
                        <div className="text-sm text-gray-400 mb-1">Currently Active</div>
                        <div className={`text-lg font-semibold ${$teamState.activeTeam === 'green' ? 'text-green-400' : $teamState.activeTeam === 'yellow' ? 'text-yellow-400' : $teamState.activeTeam === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>
                            {$customTeamNames[$teamState.activeTeam]}
                        </div>
                        {$teamState.isRunning && $teamState.currentRunStartTime && (
                            <div className="text-sm text-gray-300 font-mono">
                                {formatDuration(currentTime - $teamState.currentRunStartTime)}
                            </div>
                        )}
                    </div>
                )}

                {/* Ranked runs by duration */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-200">
                        Run Rankings ({rankedRuns.length})
                    </h3>
                    
                    {rankedRuns.length > 0 ? (
                        <div className="space-y-2">
                            {rankedRuns.slice(0, 8).map((run, index) => (
                                <div key={run.id} className="relative">
                                    {/* Rank indicator */}
                                    <div className="absolute -left-2 top-2 z-10">
                                        <div className={`
                                            w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                            ${index === 0 
                                                ? 'bg-yellow-400 text-yellow-900' 
                                                : index === 1 
                                                ? 'bg-gray-300 text-gray-800'
                                                : index === 2
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-gray-600 text-white'
                                            }
                                        `}>
                                            {index + 1}
                                        </div>
                                    </div>
                                    
                                    <TeamRunItem
                                        run={run}
                                        isLongest={longestRun?.id === run.id}
                                        currentTime={currentTime}
                                        customTeamNames={$customTeamNames}
                                    />
                                </div>
                            ))}
                            
                            {rankedRuns.length > 8 && (
                                <div className="text-gray-500 text-sm italic p-2 text-center">
                                    +{rankedRuns.length - 8} more runs
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-gray-500 text-sm italic p-2 text-center">
                            No runs yet
                        </div>
                    )}
                </div>
            </SidebarContent>

            {/* Team selection buttons */}
            <SidebarGroup className="mt-auto">
                <SidebarGroupContent>
                    <div className="p-4">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">Select Team</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.keys(TEAM_COLORS) as TeamColor[])
                                .filter(team => $enabledTeams[team])
                                .map(team => (
                                <SidebarMenuButton
                                    key={team}
                                    className={`
                                        h-12 text-white font-semibold transition-all
                                        ${$selectedTeam === null || $selectedTeam === team 
                                            ? TEAM_COLORS[team] 
                                            : `bg-gray-500 border-gray-600 opacity-50 hover:opacity-100 ${TEAM_COLORS[team].split(' ')[1]}`
                                        }
                                        ${$selectedTeam === team ? 'ring-2 ring-white' : ''}
                                    `}
                                    onClick={() => handleTeamSelect(team)}
                                >
                                    {$customTeamNames[team]}
                                </SidebarMenuButton>
                            ))}
                        </div>
                    </div>
                </SidebarGroupContent>
            </SidebarGroup>
        </TeamSidebarContainer>
    );
};
