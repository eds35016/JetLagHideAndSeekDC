import { useStore } from "@nanostores/react";
import { useEffect, useState } from "react";

import { wmataApiKey } from "@/lib/context";

interface TrainPrediction {
    Car: string;
    Destination: string;
    DestinationCode: string;
    DestinationName: string;
    Group: string;
    Line: string;
    LocationCode: string;
    LocationName: string;
    Min: string;
}

interface TrainPredictionsResponse {
    Trains: TrainPrediction[];
}

interface TrainPredictionsProps {
    stationCode: string | string[];
    isOpen: boolean;
    isDarkMode?: boolean; // Add prop to control text colors for mobile drawer
}

const getLineColorClass = (line: string): string => {
    const colorMap: Record<string, string> = {
        RD: 'bg-red-600',
        BL: 'bg-blue-500', 
        OR: 'bg-orange-500',
        YL: 'bg-yellow-400',
        GR: 'bg-green-500',
        SV: 'bg-gray-500',
    };
    return colorMap[line] || 'bg-gray-600';
};

export const TrainPredictions = ({ stationCode, isOpen, isDarkMode = false }: TrainPredictionsProps) => {
    const $wmataApiKey = useStore(wmataApiKey);
    const [predictions, setPredictions] = useState<TrainPrediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Define colors based on dark mode
    const colors = {
        heading: isDarkMode ? "#ffffff" : "#333",
        text: isDarkMode ? "#d1d5db" : "#6b7280", 
        muted: isDarkMode ? "#9ca3af" : "#666",
        error: "#dc2626"
    };

    const fetchPredictions = async () => {
        if (!$wmataApiKey || !stationCode) return;

        setLoading(true);
        setError(null);

        try {
            // Handle both single and multiple station codes
            const codes = Array.isArray(stationCode) ? stationCode : [stationCode];
            const stationCodeParam = codes.join(',');
            
            const response = await fetch(
                `https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${stationCodeParam}?api_key=${$wmataApiKey}`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: TrainPredictionsResponse = await response.json();
            
            // Sort predictions by arrival time for better UX
            const sortedTrains = (data.Trains || []).sort((a, b) => {
                // Handle special cases for arrival status
                const getMinutes = (min: string): number => {
                    if (min === 'ARR' || min === 'BRD') return 0;
                    if (min === '---' || !min) return 999;
                    const parsed = parseInt(min);
                    return isNaN(parsed) ? 999 : parsed;
                };
                
                return getMinutes(a.Min) - getMinutes(b.Min);
            });
            
            setPredictions(sortedTrains);
        } catch (err) {
            console.error('Failed to fetch train predictions:', err);
            setError('Failed to load train times');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || !$wmataApiKey) {
            // Clear predictions when popup is closed
            setPredictions([]);
            setError(null);
            setLoading(false);
            return;
        }

        // Initial fetch
        fetchPredictions();

        // Set up auto-refresh every 32 seconds
        const interval = setInterval(fetchPredictions, 32000);

        return () => {
            clearInterval(interval);
        };
    }, [isOpen, $wmataApiKey, stationCode]);

    if (!$wmataApiKey) {
        return null;
    }

    if (loading && predictions.length === 0) {
        return (
            <div style={{ marginTop: "12px" }}>
                <h4 style={{ fontWeight: "600", marginBottom: "8px", fontSize: "14px", color: colors.heading }}>Train Arrivals</h4>
                <div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ width: "32px", height: "24px", backgroundColor: "#e5e7eb", borderRadius: "4px", marginRight: "8px", animation: "pulse 2s infinite" }}></div>
                            <div style={{ flex: "1", height: "16px", backgroundColor: "#e5e7eb", borderRadius: "4px", marginRight: "8px", animation: "pulse 2s infinite" }}></div>
                            <div style={{ width: "48px", height: "16px", backgroundColor: "#e5e7eb", borderRadius: "4px", animation: "pulse 2s infinite" }}></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ marginTop: "12px" }}>
                <h4 style={{ fontWeight: "600", marginBottom: "8px", fontSize: "14px", color: colors.heading }}>Train Arrivals</h4>
                <p style={{ color: colors.error, fontSize: "12px" }}>{error}</p>
            </div>
        );
    }

    if (predictions.length === 0 && !loading) {
        return (
            <div style={{ marginTop: "12px" }}>
                <h4 style={{ fontWeight: "600", marginBottom: "8px", fontSize: "14px", color: colors.heading }}>Train Arrivals</h4>
                <p style={{ color: colors.text, fontSize: "12px" }}>No trains scheduled</p>
            </div>
        );
    }

    return (
        <div style={{ marginTop: "12px" }}>
            <h4 style={{ fontWeight: "600", marginBottom: "8px", fontSize: "14px", color: colors.heading }}>
                Train Arrivals
                {loading && (
                    <span style={{ marginLeft: "8px", fontSize: "12px", color: colors.muted }}>Updating...</span>
                )}
            </h4>
            <div style={{ maxHeight: "128px", overflowY: "auto" }}>
                {predictions.slice(0, 6).map((train, index) => (
                    <div key={index} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                            <span
                                className={`${getLineColorClass(train.Line)}`}
                                style={{ 
                                    padding: "2px 6px", 
                                    fontSize: "10px", 
                                    fontWeight: "bold", 
                                    color: "white", 
                                    borderRadius: "4px",
                                    marginRight: "8px"
                                }}
                            >
                                {train.Line}
                            </span>
                            <span style={{ fontWeight: "500", marginRight: "4px", color: colors.heading }}>{train.Destination}</span>
                            {train.Car && (
                                <span style={{ fontSize: "10px", color: colors.muted }}>({train.Car} car)</span>
                            )}
                        </div>
                        <span style={{ fontWeight: "600", color: colors.heading }}>
                            {train.Min === 'ARR' ? 'Arriving' : 
                             train.Min === 'BRD' ? 'Boarding' :
                             train.Min === '---' || !train.Min ? '--' :
                             `${train.Min} min`}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
