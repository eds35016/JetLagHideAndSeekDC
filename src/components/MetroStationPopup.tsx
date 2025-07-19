import React from "react";
import { TrainPredictions } from "./TrainPredictions";

interface MetroStationPopupProps {
    name: string;
    address: string;
    lines: string[];
    lineColors: string[];
    webUrl?: string;
    trainInfoUrl?: string;
    stationCode?: string;
    objectId: number;
    cheatMode: boolean;
    endgameZones: Set<string>;
    onToggleEndgameZone: () => void;
}

export const MetroStationPopup: React.FC<MetroStationPopupProps> = ({
    name,
    address,
    lines,
    lineColors,
    webUrl,
    trainInfoUrl,
    stationCode,
    objectId,
    cheatMode,
    endgameZones,
    onToggleEndgameZone,
}) => {
    const hasEndgameZone = endgameZones.has(objectId.toString());

    return (
        <div style={{ fontFamily: "'Poppins', sans-serif", minWidth: "200px" }}>
            <h3 style={{ margin: "0 0 8px 0", color: "#333", fontSize: "16px" }}>
                {name}
            </h3>
            <div style={{ marginBottom: "8px" }}>
                {lines.map((line: string, index: number) => (
                    <span
                        key={index}
                        style={{
                            backgroundColor: lineColors[index],
                            color: "white",
                            padding: "2px 6px",
                            borderRadius: "8px",
                            fontSize: "10px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            marginRight: "4px",
                            display: "inline-block",
                            marginBottom: "2px",
                        }}
                    >
                        {line}
                    </span>
                ))}
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#666" }}>
                {address}
            </p>
            
            {/* Train Predictions */}
            {stationCode && (
                <TrainPredictions stationCode={stationCode} isOpen={true} />
            )}
            
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" }}>
                {cheatMode && webUrl && (
                    <a
                        href={webUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: "#0066cc",
                            textDecoration: "none",
                            fontSize: "12px",
                            background: "#f0f8ff",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #0066cc",
                        }}
                    >
                        Station Info
                    </a>
                )}
                {trainInfoUrl && (
                    <a
                        href={trainInfoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: "#228B22",
                            textDecoration: "none",
                            fontSize: "12px",
                            background: "#f0fff0",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #228B22",
                        }}
                    >
                        Train Times
                    </a>
                )}
                <button
                    onClick={onToggleEndgameZone}
                    style={{
                        color: hasEndgameZone ? "#dc2626" : "#7c3aed",
                        background: hasEndgameZone ? "#fef2f2" : "#f3f4f6",
                        border: `1px solid ${hasEndgameZone ? "#dc2626" : "#7c3aed"}`,
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                        textDecoration: "none",
                    }}
                >
                    {hasEndgameZone ? "Hide Endgame Zone" : "Show Endgame Zone"}
                </button>
            </div>
        </div>
    );
};
