import { useStore } from "@nanostores/react";
import type { FeatureCollection, LineString, Feature, Point } from "geojson";
import * as L from "leaflet";
import { useEffect, useState } from "react";
import { GeoJSON, useMap, Circle } from "react-leaflet";
import { createRoot } from "react-dom/client";

import { highlightTrainLines, cheatMode, showMetroEntrances, wmataApiKey } from "@/lib/context";
import { TrainPredictions } from "./TrainPredictions";
import { getStationCode, normalizeStationCodes } from "./stationCodes";

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

export const MetroLinesOverlay = () => {
    const map = useMap();
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
    
    // Store React roots for proper cleanup
    const reactRoots = new Map<string, any>();

    // Load the GeoJSON data for both lines and stops
    useEffect(() => {
        const loadMetroData = async () => {
            try {
                // In development, we need to include the base path manually
                const basePath = import.meta.env.DEV ? '/JetLagHideAndSeek/' : import.meta.env.BASE_URL;
                
                // Load metro lines
                const linesUrl = `${basePath}DC/Metro_Lines_Regional.geojson`;
                console.log('Fetching lines from:', linesUrl);
                const linesResponse = await fetch(linesUrl);
                const linesData = await linesResponse.json();
                setMetroLinesData(linesData);

                // Load metro stops
                const stopsUrl = `${basePath}DC/Metro_Stations_Regional.geojson`;
                console.log('Fetching stops from:', stopsUrl);
                const stopsResponse = await fetch(stopsUrl);
                const stopsData = await stopsResponse.json();
                setMetroStopsData(stopsData);

                // Load metro entrances
                const entrancesUrl = `${basePath}DC/Metro_Station_Entrances_Regional.geojson`;
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
                            const lines = props.LINE.split(',').map((line: string) => line.trim());
                            const lineColors = lines.map((line: string) => metroLineColors[line.toLowerCase()] || '#666666');
                            const stationCodes = props.STATIONCODE ? 
                                normalizeStationCodes(props.STATIONCODE) : 
                                normalizeStationCodes(getStationCode(props.NAME));
                            
                            // Get railway lines for this station
                            const railwayLines = STATION_RAILWAY_LINES[props.NAME] || [];
                            
                            // Create popup content
                            const trainPredictionsId = `train-predictions-${props.OBJECTID}`;
                            const popupContent = `
                                <div style="font-family: 'Poppins', sans-serif; min-width: 200px;">
                                    <h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px;">
                                        ${props.NAME}
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
                            
                            // Set up global function for endgame zone toggle
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
        </>
    );
};
