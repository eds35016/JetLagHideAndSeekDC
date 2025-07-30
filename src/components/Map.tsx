import "leaflet/dist/leaflet.css";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import "leaflet-contextmenu";

import { useStore } from "@nanostores/react";
import * as turf from "@turf/turf";
import * as L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, ScaleControl, TileLayer } from "react-leaflet";
import { toast } from "react-toastify";

import { useIsMobile } from "@/hooks/use-mobile";

import {
    additionalMapGeoLocations,
    addQuestion,
    animateMapMovements,
    autoZoom,
    developerMode,
    followMe,
    hiderMode,
    highlightTrainLines,
    isLoading,
    leafletMapContext,
    mapGeoJSON,
    mapGeoLocation,
    planningModeEnabled,
    polyGeoJSON,
    questionFinishedMapData,
    questions,
    thunderforestApiKey,
    triggerLocalRefresh,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import { applyQuestionsToMapGeoData, holedMask } from "@/maps";
import { hiderifyQuestion } from "@/maps";
import { clearCache, determineMapBoundaries } from "@/maps/api";

import { DraggableMarkers } from "./DraggableMarkers";
import { LeafletFullScreenButton } from "./LeafletFullScreenButton";
import { MapPrint } from "./MapPrint";
import { MetroLinesOverlay } from "./MetroLinesOverlay";
import { PolygonDraw } from "./PolygonDraw";

export const Map = ({ className }: { className?: string }) => {
    useStore(additionalMapGeoLocations);
    const $mapGeoLocation = useStore(mapGeoLocation);
    const $questions = useStore(questions);
    const $highlightTrainLines = useStore(highlightTrainLines);
    const $thunderforestApiKey = useStore(thunderforestApiKey);
    const $hiderMode = useStore(hiderMode);
    const $isLoading = useStore(isLoading);
    const $followMe = useStore(followMe);
    const $developerMode = useStore(developerMode);
    const map = useStore(leafletMapContext);
    const isMobile = useIsMobile();

    const followMeMarkerRef = useMemo(
        () => ({ current: null as L.Marker | null }),
        [],
    );
    const geoWatchIdRef = useMemo(
        () => ({ current: null as number | null }),
        [],
    );

    const refreshQuestions = async (focus: boolean = false) => {
        if (!map) return;

        if ($isLoading) return;

        isLoading.set(true);

        if ($questions.length === 0) {
            await clearCache();
        }

        let mapGeoData = mapGeoJSON.get();

        if (!mapGeoData) {
            const polyGeoData = polyGeoJSON.get();
            if (polyGeoData) {
                mapGeoData = polyGeoData;
                mapGeoJSON.set(polyGeoData);
            } else {
                await toast.promise(
                    determineMapBoundaries()
                        .then((x) => {
                            mapGeoJSON.set(x);
                            mapGeoData = x;
                        })
                        .catch((error) => console.log(error)),
                    {
                        error: "Error refreshing map data",
                    },
                );
            }
        }

        if ($hiderMode !== false) {
            for (const question of $questions) {
                await hiderifyQuestion(question);
            }

            triggerLocalRefresh.set(Math.random()); // Refresh the question sidebar with new information but not this map
        }

        map.eachLayer((layer: any) => {
            if (layer.questionKey || layer.questionKey === 0) {
                map.removeLayer(layer);
            }
        });

        try {
            mapGeoData = await applyQuestionsToMapGeoData(
                $questions,
                mapGeoData,
                planningModeEnabled.get(),
                (geoJSONObj, question) => {
                    const geoJSONPlane = L.geoJSON(geoJSONObj, {
                        interactive: false, // Allow clicks to pass through to underlying layers like metro stations
                    });
                    // @ts-expect-error This is a check such that only this type of layer is removed
                    geoJSONPlane.questionKey = question.key;
                    geoJSONPlane.addTo(map);
                },
            );

            mapGeoData = {
                type: "FeatureCollection",
                features: [holedMask(mapGeoData!)!],
            };

            map.eachLayer((layer: any) => {
                if (layer.eliminationGeoJSON) {
                    // Hopefully only geoJSON layers
                    map.removeLayer(layer);
                }
            });

            const g = L.geoJSON(mapGeoData, {
                interactive: false, // Allow clicks to pass through to underlying layers like metro stations
            });
            // @ts-expect-error This is a check such that only this type of layer is removed
            g.eliminationGeoJSON = true;
            g.addTo(map);

            questionFinishedMapData.set(mapGeoData);

            if (autoZoom.get() && focus) {
                const bbox = turf.bbox(holedMask(mapGeoData) as any);
                const bounds = [
                    [bbox[1], bbox[0]],
                    [bbox[3], bbox[2]],
                ];

                if (animateMapMovements.get()) {
                    map.flyToBounds(bounds as any);
                } else {
                    map.fitBounds(bounds as any);
                }
            }
        } catch (error) {
            console.log(error);

            isLoading.set(false);
            if (document.querySelectorAll(".Toastify__toast").length === 0) {
                return toast.error("No solutions found / error occurred");
            }
        } finally {
            isLoading.set(false);
        }
    };

    const displayMap = useMemo(
        () => (
            <MapContainer
                center={$mapGeoLocation.geometry.coordinates}
                zoom={5}
                className={cn("w-[500px] h-[500px]", className)}
                ref={leafletMapContext.set}
                // @ts-expect-error Typing doesn't update from react-contextmenu
                contextmenu={!isMobile}
                contextmenuWidth={!isMobile ? 140 : 0}
                contextmenuItems={!isMobile ? [
                    {
                        text: "Add Radius",
                        callback: (e: any) =>
                            addQuestion({
                                id: "radius",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            }),
                    },
                    {
                        text: "Add Thermometer",
                        callback: (e: any) => {
                            const destination = turf.destination(
                                [e.latlng.lng, e.latlng.lat],
                                5,
                                90,
                                {
                                    units: "miles",
                                },
                            );

                            addQuestion({
                                id: "thermometer",
                                data: {
                                    latA: e.latlng.lat,
                                    lngA: e.latlng.lng,
                                    latB: destination.geometry.coordinates[1],
                                    lngB: destination.geometry.coordinates[0],
                                },
                            });
                        },
                    },
                    {
                        text: "Add Tentacles",
                        callback: (e: any) => {
                            addQuestion({
                                id: "tentacles",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: "Add Matching",
                        callback: (e: any) => {
                            addQuestion({
                                id: "matching",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: "Add Measuring",
                        callback: (e: any) => {
                            addQuestion({
                                id: "measuring",
                                data: {
                                    lat: e.latlng.lat,
                                    lng: e.latlng.lng,
                                },
                            });
                        },
                    },
                    {
                        text: "Copy Coordinates",
                        callback: (e: any) => {
                            if (!navigator || !navigator.clipboard) {
                                toast.error(
                                    "Clipboard API not supported in your browser",
                                );
                                return;
                            }

                            const latitude = e.latlng.lat;
                            const longitude = e.latlng.lng;

                            toast.promise(
                                navigator.clipboard.writeText(
                                    `${Math.abs(latitude)}°${latitude > 0 ? "N" : "S"}, ${Math.abs(
                                        longitude,
                                    )}°${longitude > 0 ? "E" : "W"}`,
                                ),
                                {
                                    pending: "Writing to clipboard...",
                                    success: "Coordinates copied!",
                                    error: "An error occurred while copying",
                                },
                                { autoClose: 1000 },
                            );
                        },
                    },
                ] : undefined}
            >
                {!($highlightTrainLines && $thunderforestApiKey) && (
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="https://carto.com/attributions">CARTO</a>; &copy; <a href="http://www.thunderforest.com/">Thunderforest</a>; Powered by Esri and Turf.js'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        subdomains="abcd"
                        maxZoom={20} // This technically should be 6, but once the ratelimiting starts this can take over
                        minZoom={2}
                        noWrap
                    />
                )}
                {$highlightTrainLines && $thunderforestApiKey && (
                    <TileLayer
                        url={`https://tile.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=${$thunderforestApiKey}`}
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors; &copy; <a href="https://carto.com/attributions">CARTO</a>; &copy; <a href="http://www.thunderforest.com/">Thunderforest</a>; Powered by Esri and Turf.js'
                        maxZoom={22}
                        minZoom={2}
                        noWrap
                    />
                )}
                <MetroLinesOverlay />
                <DraggableMarkers />
                <div className="leaflet-top leaflet-right">
                    <div className="leaflet-control flex-col flex gap-2">
                        <LeafletFullScreenButton />
                    </div>
                </div>
                <PolygonDraw />
                <ScaleControl position="bottomleft" />
                <MapPrint
                    position="topright"
                    sizeModes={["Current", "A4Portrait", "A4Landscape"]}
                    hideControlContainer={false}
                    hideClasses={[
                        "leaflet-full-screen-specific-name",
                        "leaflet-top",
                        "leaflet-control-easyPrint",
                        "leaflet-draw",
                    ]}
                    title="Print"
                />
            </MapContainer>
        ),
        [map, $highlightTrainLines, $thunderforestApiKey, isMobile],
    );

    useEffect(() => {
        if (!map) return;

        refreshQuestions(true);
    }, [$questions, map, $hiderMode]);

    useEffect(() => {
        const intervalId = setInterval(async () => {
            if (!map) return;
            let layerCount = 0;
            map.eachLayer((layer: any) => {
                if (layer.eliminationGeoJSON) {
                    // Hopefully only geoJSON layers
                    layerCount++;
                }
            });
            if (layerCount > 1) {
                console.log("Too many layers, refreshing...");
                refreshQuestions(false);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, [map]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const mainElement: HTMLElement | null =
                document.querySelector("main");

            if (mainElement) {
                if (document.fullscreenElement) {
                    mainElement.classList.add("fullscreen");
                } else {
                    mainElement.classList.remove("fullscreen");
                }
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullscreenChange,
            );
        };
    }, []);

    useEffect(() => {
        if (!map) return;
        if (!$followMe) {
            if (followMeMarkerRef.current) {
                map.removeLayer(followMeMarkerRef.current);
                followMeMarkerRef.current = null;
            }
            if (geoWatchIdRef.current !== null) {
                navigator.geolocation.clearWatch(geoWatchIdRef.current);
                geoWatchIdRef.current = null;
            }
            return;
        }

        geoWatchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (followMeMarkerRef.current) {
                    followMeMarkerRef.current.setLatLng([lat, lng]);
                } else {
                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            html: `<div class="text-blue-700 bg-white rounded-full border-2 border-blue-700 shadow w-5 h-5 flex items-center justify-center"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2A81CB" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="#2A81CB"/></svg></div>`,
                            className: "",
                        }),
                        zIndexOffset: 1000,
                    });
                    marker.addTo(map);
                    followMeMarkerRef.current = marker;
                }
            },
            () => {
                toast.error("Unable to access your location.");
                followMe.set(false);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
        );
        return () => {
            if (followMeMarkerRef.current) {
                map.removeLayer(followMeMarkerRef.current);
                followMeMarkerRef.current = null;
            }
            if (geoWatchIdRef.current !== null) {
                navigator.geolocation.clearWatch(geoWatchIdRef.current);
                geoWatchIdRef.current = null;
            }
        };
    }, [$followMe, map]);

    // Control zone sidebar trigger visibility based on developer mode
    useEffect(() => {
        const zoneSidebarTrigger = document.getElementById("zone-sidebar-trigger");
        if (zoneSidebarTrigger) {
            if ($developerMode) {
                zoneSidebarTrigger.style.display = "block";
            } else {
                zoneSidebarTrigger.style.display = "none";
            }
        }
    }, [$developerMode]);

        // Explicitly disable context menu on mobile
    useEffect(() => {
        if (!map) return;
        
        if (isMobile) {
            // Disable context menu completely on mobile
            (map.options as any).contextmenu = false;
            // Remove any existing context menu handlers
            if ((map as any).contextmenu) {
                (map as any).contextmenu.disable();
            }
            // Prevent default context menu on long press/right click
            const mapContainer = map.getContainer();
            if (mapContainer) {
                const preventContextMenu = (e: Event) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                };
                mapContainer.addEventListener('contextmenu', preventContextMenu);
                mapContainer.addEventListener('touchstart', (e: TouchEvent) => {
                    if (e.touches.length === 1) {
                        // Prevent long press context menu
                        let timeout = setTimeout(() => {
                            e.preventDefault();
                            e.stopPropagation();
                        }, 500);
                        
                        const clearTimer = () => {
                            clearTimeout(timeout);
                            mapContainer.removeEventListener('touchend', clearTimer);
                            mapContainer.removeEventListener('touchmove', clearTimer);
                        };
                        
                        mapContainer.addEventListener('touchend', clearTimer);
                        mapContainer.addEventListener('touchmove', clearTimer);
                    }
                });
                
                return () => {
                    mapContainer.removeEventListener('contextmenu', preventContextMenu);
                };
            }
        } else {
            // Re-enable context menu on desktop
            (map.options as any).contextmenu = true;
            if ((map as any).contextmenu) {
                (map as any).contextmenu.enable();
            }
        }
    }, [map, isMobile]);

    // Prevent page scrolling when interacting with map on mobile
    useEffect(() => {
        if (!map || !isMobile) return;

        const mapContainer = map.getContainer();
        if (!mapContainer) return;

        const preventPageScroll = (e: TouchEvent) => {
            const target = e.target as Element;
            
            // Check if the touch target is within a scrollable container
            // Allow scrolling in train predictions and other scrollable components
            const isInScrollableContainer = target.closest('.train-predictions-scroll') ||
                                          target.closest('[data-allow-scroll]') ||
                                          target.closest('.overflow-y-auto') ||
                                          target.closest('.overflow-auto');
            
            // Check if touching a Leaflet interactive element (markers, popups, controls)
            const isLeafletInteractive = target.closest('.leaflet-marker-icon') ||
                                        target.closest('.leaflet-popup') ||
                                        target.closest('.leaflet-popup-content') ||
                                        target.closest('.leaflet-popup-content-wrapper') ||
                                        target.closest('.leaflet-control') ||
                                        target.closest('.leaflet-interactive') ||
                                        target.matches('path') || // SVG paths in markers
                                        target.matches('circle') || // SVG circles in markers
                                        (target as HTMLElement).style?.pointerEvents !== 'none';
            
            // Only prevent scrolling if not in a scrollable container and not on interactive elements
            if (!isInScrollableContainer && !isLeafletInteractive) {
                e.preventDefault();
                // Also prevent body scrolling during map interaction
                document.body.style.overflow = 'hidden';
            }
        };

        const preventPageScrollMove = (e: TouchEvent) => {
            const target = e.target as Element;
            
            const isInScrollableContainer = target.closest('.train-predictions-scroll') ||
                                          target.closest('[data-allow-scroll]') ||
                                          target.closest('.overflow-y-auto') ||
                                          target.closest('.overflow-auto');
            
            // Allow touch move on interactive elements for proper gesture handling
            const isLeafletInteractive = target.closest('.leaflet-marker-icon') ||
                                        target.closest('.leaflet-popup') ||
                                        target.closest('.leaflet-popup-content') ||
                                        target.closest('.leaflet-popup-content-wrapper') ||
                                        target.closest('.leaflet-control') ||
                                        target.closest('.leaflet-interactive') ||
                                        target.matches('path') ||
                                        target.matches('circle');
            
            if (!isInScrollableContainer && !isLeafletInteractive) {
                e.preventDefault();
            }
        };

        const restoreBodyScroll = () => {
            // Restore body scrolling when touch interaction ends
            document.body.style.overflow = '';
        };

        // Add touch event listeners to prevent page scrolling
        mapContainer.addEventListener('touchstart', preventPageScroll, { passive: false });
        mapContainer.addEventListener('touchmove', preventPageScrollMove, { passive: false });
        mapContainer.addEventListener('touchend', restoreBodyScroll, { passive: true });
        mapContainer.addEventListener('touchcancel', restoreBodyScroll, { passive: true });

        return () => {
            mapContainer.removeEventListener('touchstart', preventPageScroll);
            mapContainer.removeEventListener('touchmove', preventPageScrollMove);
            mapContainer.removeEventListener('touchend', restoreBodyScroll);
            mapContainer.removeEventListener('touchcancel', restoreBodyScroll);
            // Ensure body scroll is restored on cleanup
            document.body.style.overflow = '';
        };
    }, [map, isMobile]);

    return displayMap;
};
