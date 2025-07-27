import { useStore } from "@nanostores/react";
import type { FeatureCollection, LineString, Feature, Point } from "geojson";
import * as L from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, useMap, Circle } from "react-leaflet";
import { createRoot } from "react-dom/client";

import { highlightTrainLines, cheatMode, showMetroEntrances, wmataApiKey } from "@/lib/context";
import { TrainPredictions } from "./TrainPredictions";
import { getStationCode, normalizeStationCodes } from "./stationCodes";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

// Railway line colors
const RAILWAY_COLORS: Record<string, string> = {
    "MARC-Brunswick": "#FFD100", // yellow (same as metro yellow)
    "MARC-Penn": "#E51636", // red (same as metro red)
    "MARC-Camden": "#ED8B00", // orange (same as metro orange)
    "Manassas": "#009CDB", // blue (same as metro blue)
    "Fredericksburg": "#E51636", // red (same as metro red)
};

// Station to railway line mapping
const STATION_RAILWAY_LINES: Record<string, string[]> = {
    "Union Station": ["MARC-Brunswick", "MARC-Penn", "MARC-Camden", "Manassas", "Fredericksburg"],
    "Silver Spring": ["MARC-Brunswick"],
    "Rockville": ["MARC-Brunswick"],
    "Landover": ["MARC-Penn"],
    "New Carrollton": ["MARC-Penn"],
    "College Park-U of Md": ["MARC-Camden"],
    "Greenbelt": ["MARC-Camden"],
    "L'Enfant Plaza": ["Manassas", "Fredericksburg"],
    "King St-Old Town": ["Manassas", "Fredericksburg"],
    "Franconia-Springfield": ["Fredericksburg"],
};

interface MetroLineProperties {
    NAME: string;
    WEB_URL: string;
    GIS_ID: string;
    OBJECTID: number;
    [key: string]: any;
}

interface MetroStopProperties {
    OBJECTID: number;
    GIS_ID: string;
    NAME: string;
    WEB_URL: string;
    ADDRESS: string;
    LINE: string; // Updated property name
    TRAININFO_URL?: string; // New property
    STATIONCODE?: string; // Station code for WMATA API
    [key: string]: any;
}

interface MetroEntranceProperties {
    OBJECTID: number;
    GIS_ID: string;
    NAME: string;
    WEB_URL?: string;
    ADDRESS?: string;
    LINE?: string;
    [key: string]: any;
}

// Define colors for each metro line
const metroLineColors: Record<string, string> = {
    red: "#E51636",
    blue: "#009CDB", 
    orange: "#ED8B00",
    yellow: "#FFD100",
    green: "#00B04F",
    silver: "#919D9D",
};

// Function to get the primary color for a metro stop based on its lines
const getStopColor = (metroLines: string): string => {
    const lines = metroLines.toLowerCase().split(',').map((line: string) => line.trim());
    // Return the color of the first line
    return metroLineColors[lines[0]] || '#666666';
};

// Station details component for mobile drawer
interface StationDetailsProps {
    station: MetroStopProperties;
    endgameZones: Set<string>;
    onToggleEndgameZone: (stationId: string) => void;
    cheatMode: boolean;
    wmataApiKey: string;
}

const StationDetails = ({ station, endgameZones, onToggleEndgameZone, cheatMode, wmataApiKey }: StationDetailsProps) => {
    const lines = station.LINE.split(',').map((line: string) => line.trim());
    const lineColors = lines.map((line: string) => metroLineColors[line.toLowerCase()] || '#666666');
    const stationCodes = station.STATIONCODE ? 
        normalizeStationCodes(station.STATIONCODE) : 
        normalizeStationCodes(getStationCode(station.NAME));
    
    // Get railway lines for this station
    const railwayLines = STATION_RAILWAY_LINES[station.NAME] || [];
    const displayName = station.NAME === "King St-Old Town" ? "King St-Old Town/Alexandria" : station.NAME;
    const isEndgameZone = endgameZones.has(station.OBJECTID.toString());

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{displayName}</h3>
                
                <div className="flex flex-wrap gap-1">
                    {lines.map((line: string, index: number) => (
                        <span 
                            key={`${line}-${index}`}
                            className="inline-block px-2 py-1 text-xs font-bold text-white rounded-lg uppercase"
                            style={{ backgroundColor: lineColors[index] }}
                        >
                            {line}
                        </span>
                    ))}
                    {railwayLines.map((railwayLine: string) => (
                        <span 
                            key={railwayLine}
                            className="inline-block px-2 py-1 text-xs font-medium rounded-lg uppercase border-2 bg-transparent text-white"
                            style={{ 
                                borderColor: RAILWAY_COLORS[railwayLine]
                            }}
                        >
                            {railwayLine}
                        </span>
                    ))}
                </div>
                
                <p className="text-sm text-gray-300">{station.ADDRESS}</p>
            </div>

            {wmataApiKey && stationCodes.length > 0 && (
                <div>
                    <TrainPredictions 
                        stationCode={stationCodes.length === 1 ? stationCodes[0] : stationCodes} 
                        isOpen={true}
                        isDarkMode={true}
                    />
                </div>
            )}

            <div className="flex flex-col gap-2">
                {cheatMode && station.WEB_URL && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                        className="font-bold text-blue-600 border-blue-600 bg-blue-50 hover:bg-blue-100"
                    >
                        <a href={station.WEB_URL} target="_blank" rel="noopener noreferrer">
                            Station Info
                        </a>
                    </Button>
                )}
                
                {station.TRAININFO_URL && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        asChild
                        className="font-bold !text-white border-teal-600 bg-teal-600 hover:bg-teal-700 hover:!text-white"
                    >
                        <a href={station.TRAININFO_URL} target="_blank" rel="noopener noreferrer" className="!text-white">
                            Train Times
                        </a>
                    </Button>
                )}
                
                <Button 
                    variant={isEndgameZone ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => onToggleEndgameZone(station.OBJECTID.toString())}
                    className={`font-bold ${
                        isEndgameZone 
                            ? 'text-white bg-red-600 hover:bg-red-700' 
                            : 'text-white border-purple-700 bg-purple-700 hover:bg-purple-800'
                    }`}
                >
                    {isEndgameZone ? 'Hide Endgame Zone' : 'Show Endgame Zone'}
                </Button>
            </div>
        </div>
    );
};

// Custom station drawer component without overlay that can be minimized
interface StationDrawerProps {
    isOpen: boolean;
    isMinimized: boolean;
    station: MetroStopProperties | null;
    onClose: () => void;
    onToggleMinimize: () => void;
    endgameZones: Set<string>;
    onToggleEndgameZone: (stationId: string) => void;
    cheatMode: boolean;
    wmataApiKey: string;
}

const StationDrawer = ({ 
    isOpen, 
    isMinimized, 
    station, 
    onClose, 
    onToggleMinimize, 
    endgameZones, 
    onToggleEndgameZone, 
    cheatMode, 
    wmataApiKey 
}: StationDrawerProps) => {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [hasAnimated, setHasAnimated] = useState(false);

    // Reset animation state when drawer opens/closes or station changes
    useEffect(() => {
        if (isOpen && station) {
            // If drawer is already open and we're just switching stations, don't animate
            if (hasAnimated && isOpen) {
                // Keep animation state as true for seamless station switching
                return;
            }
            
            setHasAnimated(false);
            // Trigger animation after a brief delay to ensure proper mounting
            const timer = setTimeout(() => setHasAnimated(true), 50);
            return () => clearTimeout(timer);
        } else {
            // Reset animation state when drawer closes
            setHasAnimated(false);
        }
    }, [isOpen, station?.OBJECTID]); // Use station.OBJECTID to detect station changes

    if (!isOpen || !station) return null;

    const displayName = station.NAME === "King St-Old Town" ? "King St-Old Town/Alexandria" : station.NAME;

    // Handle touch events for swipe gestures
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientY);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        
        const distance = touchStart - touchEnd;
        const isUpSwipe = distance > 50;
        const isDownSwipe = distance < -50;

        if (isUpSwipe && isMinimized) {
            onToggleMinimize(); // Expand when swiping up while minimized
        } else if (isDownSwipe && !isMinimized) {
            onToggleMinimize(); // Minimize when swiping down while expanded
        } else if (isDownSwipe && isMinimized) {
            onClose(); // Close when swiping down while minimized
        }
    };

    return (
        <div 
            className={`fixed inset-x-0 bottom-0 z-[1040] bg-background border-t rounded-t-[10px] transition-all duration-300 ease-in-out ${
                isMinimized ? 'translate-y-[calc(100%-4rem)]' : 'translate-y-0'
            } ${
                hasAnimated ? 'translate-y-0' : 'translate-y-full'
            }`}
            style={{ 
                maxHeight: isMinimized ? '4rem' : '70vh',
                pointerEvents: 'auto', // Ensure the drawer itself is interactable
                transform: hasAnimated 
                    ? (isMinimized ? 'translateY(calc(100% - 4rem))' : 'translateY(0)') 
                    : 'translateY(100%)'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Drag handle and header */}
            <div 
                className="flex items-center justify-between p-4 cursor-pointer border-b transition-all duration-300"
                onClick={onToggleMinimize}
            >
                <div className="mx-auto h-2 w-[100px] rounded-full bg-muted absolute top-2 left-1/2 transform -translate-x-1/2" />
                <div className="flex-1 mt-2">
                    <h3 className="text-lg font-semibold text-white truncate">{displayName}</h3>
                    <p className={`text-sm text-gray-300 transition-opacity duration-300 ${isMinimized ? 'opacity-0' : 'opacity-100'}`}>
                        Metro Station Information
                    </p>
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className={`text-white hover:text-gray-200 ml-2 transition-all duration-300 text-lg ${
                        isMinimized ? 'opacity-0 scale-0' : 'opacity-100 scale-100'
                    }`}
                >
                    ×
                </Button>
            </div>

            {/* Content - only show when not minimized */}
            <div 
                className={`overflow-y-auto transition-all duration-300 ease-in-out ${
                    isMinimized 
                        ? 'opacity-0 transform translate-y-4 pointer-events-none' 
                        : 'opacity-100 transform translate-y-0 pointer-events-auto'
                }`}
                style={{ 
                    maxHeight: isMinimized ? '0' : 'calc(70vh - 5rem)',
                    transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
                }}
            >
                <StationDetails 
                    station={station}
                    endgameZones={endgameZones}
                    onToggleEndgameZone={onToggleEndgameZone}
                    cheatMode={cheatMode}
                    wmataApiKey={wmataApiKey}
                />
            </div>
        </div>
    );
};

export const MetroLinesOverlay = () => {
    const map = useMap();
    const isMobile = useIsMobile();
    const $highlightTrainLines = useStore(highlightTrainLines);
    const $cheatMode = useStore(cheatMode);
    const $showMetroEntrances = useStore(showMetroEntrances);
    const $wmataApiKey = useStore(wmataApiKey);
    const [showOverlay, setShowOverlay] = useState(false);
    const [metroLinesData, setMetroLinesData] = useState<FeatureCollection | null>(null);
    const [metroStopsData, setMetroStopsData] = useState<FeatureCollection | null>(null);
    const [metroEntrancesData, setMetroEntrancesData] = useState<FeatureCollection | null>(null);
    const [currentZoom, setCurrentZoom] = useState(10);
    const [endgameZones, setEndgameZones] = useState<Set<string>>(new Set());
    const [openPopupStationCode, setOpenPopupStationCode] = useState<string | null>(null);
    
    // Mobile drawer state
    const [selectedStation, setSelectedStation] = useState<MetroStopProperties | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDrawerMinimized, setIsDrawerMinimized] = useState(false);
    
    // Store React roots for proper cleanup
    const reactRoots = new Map<string, any>();

    // Load the GeoJSON data for both lines and stops
    useEffect(() => {
        const loadMetroData = async () => {
            try {
                // In development, we need to include the base path manually
                const basePath = import.meta.env.DEV ? '/JetLagHideAndSeek' : import.meta.env.BASE_URL;
                
                // Load metro lines
                const linesUrl = `${basePath}/DC/Metro_Lines_Regional.geojson`;
                console.log('Fetching lines from:', linesUrl);
                const linesResponse = await fetch(linesUrl);
                const linesData = await linesResponse.json();
                setMetroLinesData(linesData);

                // Load metro stops
                const stopsUrl = `${basePath}/DC/Metro_Stations_Regional.geojson`;
                console.log('Fetching stops from:', stopsUrl);
                const stopsResponse = await fetch(stopsUrl);
                const stopsData = await stopsResponse.json();
                setMetroStopsData(stopsData);

                // Load metro entrances
                const entrancesUrl = `${basePath}/DC/Metro_Station_Entrances_Regional.geojson`;
                console.log('Fetching entrances from:', entrancesUrl);
                const entrancesResponse = await fetch(entrancesUrl);
                const entrancesData = await entrancesResponse.json();
                setMetroEntrancesData(entrancesData);
            } catch (error) {
                console.error('Failed to load metro data:', error);
            }
        };
        
        loadMetroData();
    }, []);

    // Track zoom level for entrance visibility
    useEffect(() => {
        if (!map) return;

        const updateZoom = () => {
            setCurrentZoom(map.getZoom());
        };

        // Set initial zoom
        updateZoom();

        // Listen for zoom changes
        map.on('zoomend', updateZoom);

        return () => {
            map.off('zoomend', updateZoom);
        };
    }, [map]);

    // Cleanup React roots when component unmounts
    useEffect(() => {
        return () => {
            // Clean up all React roots on unmount
            reactRoots.forEach((root) => {
                root.unmount();
            });
            reactRoots.clear();
        };
    }, []);

    useEffect(() => {
        // Only show the overlay when train lines are NOT highlighted
        // This way we provide an alternative visualization when the Thunderforest overlay is disabled
        setShowOverlay(!$highlightTrainLines);
    }, [$highlightTrainLines]);

    // Auto-minimize drawer when user drags the map
    useEffect(() => {
        if (!map || !isMobile) return;

        let isDragging = false;
        let dragStarted = false;

        const handleDragStart = () => {
            dragStarted = true;
            isDragging = false;
        };

        const handleDrag = () => {
            if (dragStarted) {
                isDragging = true;
            }
        };

        const handleDragEnd = () => {
            if (isDragging && isDrawerOpen && !isDrawerMinimized) {
                // Auto-minimize the drawer when map dragging ends
                setIsDrawerMinimized(true);
            }
            dragStarted = false;
            isDragging = false;
        };

        // Add map event listeners
        map.on('dragstart', handleDragStart);
        map.on('drag', handleDrag);
        map.on('dragend', handleDragEnd);

        return () => {
            // Cleanup event listeners
            map.off('dragstart', handleDragStart);
            map.off('drag', handleDrag);
            map.off('dragend', handleDragEnd);
        };
    }, [map, isMobile, isDrawerOpen, isDrawerMinimized]);

    // Function to toggle endgame zone for a station
    const toggleEndgameZone = (stationId: string) => {
        setEndgameZones(prev => {
            const newSet = new Set(prev);
            if (newSet.has(stationId)) {
                newSet.delete(stationId);
            } else {
                newSet.add(stationId);
            }
            return newSet;
        });
    };

    // Station drawer handlers
    const handleStationClick = (station: MetroStopProperties) => {
        setSelectedStation(station);
        setIsDrawerOpen(true);
        setIsDrawerMinimized(false); // Open expanded by default
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
        setSelectedStation(null);
        setIsDrawerMinimized(false);
    };

    const handleDrawerToggleMinimize = () => {
        setIsDrawerMinimized(!isDrawerMinimized);
    };

    if (!showOverlay) {
        return null;
    }

    return (
        <>
            {/* Render metro lines */}
            {metroLinesData && (
                <GeoJSON
                    data={metroLinesData}
                    style={(feature) => {
                        const lineName = feature?.properties?.NAME;
                        return {
                            color: metroLineColors[lineName] || '#000000',
                            weight: 3,
                            opacity: 0.8,
                        };
                    }}
                    onEachFeature={(feature, layer) => {
                        if (feature.properties && feature.properties.NAME) {
                            layer.bindPopup(`
                                <div style="font-family: 'Poppins', sans-serif;">
                                    <h3 style="margin: 0 0 8px 0; color: ${metroLineColors[feature.properties.NAME] || '#000000'};">
                                        ${feature.properties.NAME.charAt(0).toUpperCase() + feature.properties.NAME.slice(1)} Line
                                    </h3>
                                    <p style="margin: 0; font-size: 12px; color: #666;">
                                        Washington Metro System
                                    </p>
                                </div>
                            `);
                        }
                    }}
                />
            )}

            {/* Render endgame zones BEFORE stations so stations appear on top */}
            {metroStopsData && endgameZones.size > 0 && (
                metroStopsData.features.map((feature: any) => {
                    if (!endgameZones.has(feature.properties.OBJECTID.toString())) {
                        return null;
                    }
                    
                    const [lng, lat] = feature.geometry.coordinates;
                    const radiusInMeters = 1609.34 * (1/3); // 1/3 mile in meters
                    
                    return (
                        <Circle
                            key={`endgame-${feature.properties.OBJECTID}`}
                            center={[lat, lng]}
                            radius={radiusInMeters}
                            pathOptions={{
                                color: '#dc2626',
                                weight: 2,
                                fillColor: '#dc2626',
                                fillOpacity: 0.1,
                                opacity: 0.6,
                                interactive: false, // Allow clicks to pass through to station marker
                            }}
                        />
                    );
                })
            )}

            {/* Render metro stops */}
            {metroStopsData && (
                <GeoJSON
                    key={`metro-stops-${$cheatMode}-${$wmataApiKey}-${Array.from(endgameZones).join(',')}`} // Add key to force re-render when cheat mode, WMATA key, or endgame zones change
                    data={metroStopsData}
                    pointToLayer={(feature, latlng) => {
                        const stopColor = getStopColor(feature.properties?.LINE || '');
                        return L.circleMarker(latlng, {
                            radius: 6,
                            fillColor: stopColor,
                            color: '#ffffff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.8,
                        });
                    }}
                    onEachFeature={(feature, layer) => {
                        if (feature.properties) {
                            const props = feature.properties as MetroStopProperties;
                            
                            // On mobile, use drawer; on desktop, use popup
                            if (isMobile) {
                                layer.on('click', () => {
                                    handleStationClick(props);
                                });
                            } else {
                                const lines = props.LINE.split(',').map((line: string) => line.trim());
                                const lineColors = lines.map((line: string) => metroLineColors[line.toLowerCase()] || '#666666');
                                const stationCodes = props.STATIONCODE ? 
                                    normalizeStationCodes(props.STATIONCODE) : 
                                    normalizeStationCodes(getStationCode(props.NAME));
                                
                                // Get railway lines for this station
                                const railwayLines = STATION_RAILWAY_LINES[props.NAME] || [];
                                
                                // Create popup content
                                const trainPredictionsId = `train-predictions-${props.OBJECTID}`;
                                const displayName = props.NAME === "King St-Old Town" ? "King St-Old Town/Alexandria" : props.NAME;
                                const popupContent = `
                                    <div style="font-family: 'Poppins', sans-serif; min-width: 200px;">
                                        <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">
                                            ${displayName}
                                        </h3>
                                        <div style="margin-bottom: 8px;">
                                            ${lines.map((line: string, index: number) => `
                                                <span style="
                                                    background-color: ${lineColors[index]};
                                                    color: white;
                                                    padding: 2px 6px;
                                                    border-radius: 8px;
                                                    font-size: 10px;
                                                    font-weight: bold;
                                                    text-transform: uppercase;
                                                    margin-right: 4px;
                                                    display: inline-block;
                                                    margin-bottom: 2px;
                                                ">${line}</span>
                                            `).join('')}
                                            ${railwayLines.map((railwayLine: string) => `
                                                <span style="
                                                    background-color: transparent;
                                                    color: ${RAILWAY_COLORS[railwayLine]};
                                                    border: 2px solid ${RAILWAY_COLORS[railwayLine]};
                                                    padding: 0px 4px;
                                                    border-radius: 8px;
                                                    font-size: 10px;
                                                    font-weight: 500;
                                                    text-transform: uppercase;
                                                    margin-right: 4px;
                                                    display: inline-block;
                                                    margin-bottom: 2px;
                                                ">${railwayLine}</span>
                                            `).join('')}
                                        </div>
                                        <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">
                                            ${props.ADDRESS}
                                        </p>
                                        ${$wmataApiKey && stationCodes.length > 0 ? `<div id="${trainPredictionsId}"></div>` : ''}
                                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                                            ${$cheatMode && props.WEB_URL ? `
                                                <a href="${props.WEB_URL}" target="_blank" style="
                                                    color: #0066cc;
                                                    text-decoration: none;
                                                    font-size: 12px;
                                                    background: #f0f8ff;
                                                    padding: 4px 8px;
                                                    border-radius: 4px;
                                                    border: 1px solid #0066cc;
                                                ">Station Info</a>
                                            ` : ''}
                                            ${props.TRAININFO_URL ? `
                                                <a href="${props.TRAININFO_URL}" target="_blank" style="
                                                    color: #228B22;
                                                    text-decoration: none;
                                                    font-size: 12px;
                                                    background: #f0fff0;
                                                    padding: 4px 8px;
                                                    border-radius: 4px;
                                                    border: 1px solid #228B22;
                                                ">Train Times</a>
                                            ` : ''}
                                            <button 
                                                onclick="window.toggleEndgameZone_${props.OBJECTID}()"
                                                style="
                                                    color: ${endgameZones.has(props.OBJECTID.toString()) ? '#dc2626' : '#7c3aed'};
                                                    background: ${endgameZones.has(props.OBJECTID.toString()) ? '#fef2f2' : '#f3f4f6'};
                                                    border: 1px solid ${endgameZones.has(props.OBJECTID.toString()) ? '#dc2626' : '#7c3aed'};
                                                    padding: 4px 8px;
                                                    border-radius: 4px;
                                                    cursor: pointer;
                                                    font-size: 12px;
                                                    text-decoration: none;
                                                "
                                            >
                                                ${endgameZones.has(props.OBJECTID.toString()) ? 'Hide Endgame Zone' : 'Show Endgame Zone'}
                                            </button>
                                        </div>
                                    </div>
                                `;
                                
                                layer.bindPopup(popupContent);
                                
                                // Handle popup open/close events for train predictions
                                layer.on('popupopen', () => {
                                    if ($wmataApiKey && stationCodes.length > 0) {
                                        setOpenPopupStationCode(stationCodes.join(','));
                                        const container = document.getElementById(trainPredictionsId);
                                        if (container && !container.hasChildNodes()) {
                                            const root = createRoot(container);
                                            reactRoots.set(trainPredictionsId, root);
                                            root.render(
                                                <TrainPredictions 
                                                    stationCode={stationCodes.length === 1 ? stationCodes[0] : stationCodes} 
                                                    isOpen={true} 
                                                />
                                            );
                                        }
                                    }
                                });
                                
                                layer.on('popupclose', () => {
                                    setOpenPopupStationCode(null);
                                    const container = document.getElementById(trainPredictionsId);
                                    if (container) {
                                        // Properly unmount the React component
                                        const root = reactRoots.get(trainPredictionsId);
                                        if (root) {
                                            root.unmount();
                                            reactRoots.delete(trainPredictionsId);
                                        }
                                        container.innerHTML = '';
                                    }
                                });
                            }
                            
                            // Set up global function for endgame zone toggle (for desktop popups)
                            (window as any)[`toggleEndgameZone_${props.OBJECTID}`] = () => {
                                toggleEndgameZone(props.OBJECTID.toString());
                            };
                            
                            // Add hover effect
                            layer.on('mouseover', function(this: L.CircleMarker, e) {
                                this.setStyle({
                                    radius: 8,
                                    weight: 3,
                                });
                            });
                            
                            layer.on('mouseout', function(this: L.CircleMarker, e) {
                                this.setStyle({
                                    radius: 6,
                                    weight: 2,
                                });
                            });
                        }
                    }}
                />
            )}

            {/* Render metro entrances */}
            {metroEntrancesData && $showMetroEntrances && currentZoom >= 14 && (
                <GeoJSON
                    key={`metro-entrances-${$cheatMode}`}
                    data={metroEntrancesData}
                    pointToLayer={(feature, latlng) => {
                        return L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: '#666666',
                            color: '#ffffff',
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.7,
                        });
                    }}
                    onEachFeature={(feature, layer) => {
                        if (feature.properties) {
                            const props = feature.properties as MetroEntranceProperties;
                            
                            // Create popup content for entrances
                            const popupContent = `
                                <div style="font-family: 'Poppins', sans-serif; min-width: 150px;">
                                    <h3 style="margin: 0 0 6px 0; color: #333; font-size: 14px;">
                                        Metro Entrance
                                    </h3>
                                    ${props.NAME ? `
                                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #666; font-weight: bold;">
                                            ${props.NAME}
                                        </p>
                                    ` : ''}
                                    ${props.ADDRESS ? `
                                        <p style="margin: 0 0 6px 0; font-size: 11px; color: #666;">
                                            ${props.ADDRESS}
                                        </p>
                                    ` : ''}
                                    ${$cheatMode && props.WEB_URL ? `
                                        <a href="${props.WEB_URL}" target="_blank" style="
                                            color: #0066cc;
                                            text-decoration: none;
                                            font-size: 11px;
                                            background: #f0f8ff;
                                            padding: 3px 6px;
                                            border-radius: 3px;
                                            border: 1px solid #0066cc;
                                        ">More Info</a>
                                    ` : ''}
                                </div>
                            `;
                            
                            layer.bindPopup(popupContent);
                            
                            // Add hover effect for entrances
                            layer.on('mouseover', function(this: L.CircleMarker, e) {
                                this.setStyle({
                                    radius: 5,
                                    weight: 2,
                                });
                            });
                            
                            layer.on('mouseout', function(this: L.CircleMarker, e) {
                                this.setStyle({
                                    radius: 4,
                                    weight: 1,
                                });
                            });
                        }
                    }}
                />
            )}

            {/* Custom mobile station drawer without overlay */}
            <StationDrawer
                isOpen={isDrawerOpen}
                isMinimized={isDrawerMinimized}
                station={selectedStation}
                onClose={handleDrawerClose}
                onToggleMinimize={handleDrawerToggleMinimize}
                endgameZones={endgameZones}
                onToggleEndgameZone={toggleEndgameZone}
                cheatMode={$cheatMode}
                wmataApiKey={$wmataApiKey}
            />
        </>
    );
};
