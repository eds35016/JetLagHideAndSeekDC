import { useStore } from "@nanostores/react";
import type { FeatureCollection, Polygon } from "geojson";
import {
    ChevronsUpDown,
    LucideMinusSquare,
    LucidePlusSquare,
    LucideX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useTutorialStep } from "@/hooks/use-tutorial-step";
import { useDebounce } from "@/hooks/useDebounce";
import {
    additionalMapGeoLocations,
    developerMode,
    isLoading,
    mapGeoJSON,
    mapGeoLocation,
    polyGeoJSON,
    questions,
} from "@/lib/context";
import { cn } from "@/lib/utils";
import {
    CacheType,
    clearCache,
    determineName,
    geocode,
    type OpenStreetMap,
} from "@/maps/api";

import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

export const PlacePicker = ({
    className = "",
}: {
    value?: OpenStreetMap | null;
    debounce?: number;
    placeholder?: string;
    language?: string;
    className?: string;
}) => {
    const $mapGeoLocation = useStore(mapGeoLocation);
    const $additionalMapGeoLocations = useStore(additionalMapGeoLocations);
    const $polyGeoJSON = useStore(polyGeoJSON);
    const $isLoading = useStore(isLoading);
    const $developerMode = useStore(developerMode);
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const debouncedValue = useDebounce<string>(inputValue);
    const [results, setResults] = useState<OpenStreetMap[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (debouncedValue === "") {
            setResults([]);
            return;
        } else {
            setLoading(true);
            setResults([]);
            geocode(debouncedValue, "en")
                .then((x) => {
                    setResults(x);
                    setLoading(false);
                })
                .catch((e) => {
                    console.log(e);
                    setError(true);
                    setLoading(false);
                });
        }
    }, [debouncedValue]);

    return (
        <Popover open={useTutorialStep(open, [3])} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-[300px] justify-between light text-slate-700",
                        className,
                    )}
                    data-tutorial-id="place-picker"
                >
                    {$polyGeoJSON
                        ? "Polygon selected"
                        : $mapGeoLocation &&
                            $mapGeoLocation.properties &&
                            $mapGeoLocation.properties.name
                          ? [
                                $mapGeoLocation,
                                ...$additionalMapGeoLocations.map(
                                    (x) => x.location,
                                ),
                            ]
                                .map((location) => determineName(location))
                                .join("; ")
                          : "Hiding bounds"}
                    <ChevronsUpDown className="opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[300px] p-0 light"
                data-tutorial-id="place-picker-content"
            >
                <div
                    className={cn(
                        "font-normal flex flex-col",
                        $polyGeoJSON && "bg-muted text-muted-foreground",
                    )}
                >
                    {[
                        { location: $mapGeoLocation, added: true, base: true },
                        ...$additionalMapGeoLocations,
                    ].map((location, index) => (
                        <div
                            className={cn(
                                "flex justify-between items-center px-3 py-2",
                                index % 2 === 1 && "bg-slate-100",
                                !$polyGeoJSON &&
                                    "transition-colors duration-200 hover:bg-slate-200",
                            )}
                            key={determineName(location.location)}
                        >
                            <span className="w-[78%] text-ellipsis">
                                {determineName(location.location)}
                            </span>
                            <div
                                className={cn(
                                    "flex flex-row gap-2 *:stroke-[1.5]",
                                    $polyGeoJSON && "hidden",
                                )}
                            >
                                {!location.base &&
                                    (location.added ? (
                                        <LucidePlusSquare
                                            className={cn(
                                                "text-green-700 cursor-pointer",
                                                $isLoading &&
                                                    "text-muted-foreground cursor-not-allowed",
                                            )}
                                            onClick={() => {
                                                if ($isLoading) return;

                                                location.added = false;

                                                additionalMapGeoLocations.set([
                                                    ...$additionalMapGeoLocations,
                                                ]);
                                                mapGeoJSON.set(null);
                                                polyGeoJSON.set(null);
                                                questions.set([
                                                    ...questions.get(),
                                                ]);
                                            }}
                                        />
                                    ) : (
                                        <LucideMinusSquare
                                            className={cn(
                                                "text-red-700 cursor-pointer",
                                                $isLoading &&
                                                    "text-muted-foreground cursor-not-allowed",
                                            )}
                                            onClick={() => {
                                                if ($isLoading) return;

                                                location.added = true;

                                                additionalMapGeoLocations.set([
                                                    ...$additionalMapGeoLocations,
                                                ]);
                                                mapGeoJSON.set(null);
                                                polyGeoJSON.set(null);
                                                questions.set([
                                                    ...questions.get(),
                                                ]);
                                            }}
                                        />
                                    ))}
                                <LucideX
                                    className={cn(
                                        "scale-[90%] text-gray-700 cursor-pointer hover:bg-slate-300 rounded-full transition-colors duration-200",
                                    )}
                                    onClick={() => {
                                        if (location.base) {
                                            const addedLocations =
                                                $additionalMapGeoLocations.filter(
                                                    (x) => x.added === true,
                                                );

                                            if (addedLocations.length > 0) {
                                                addedLocations[0].base = true;
                                                additionalMapGeoLocations.set(
                                                    additionalMapGeoLocations
                                                        .get()
                                                        .filter(
                                                            (x) =>
                                                                x.base !== true,
                                                        ),
                                                );
                                                mapGeoLocation.set(
                                                    addedLocations[0].location,
                                                );
                                            } else {
                                                return toast.error(
                                                    "Please add another location in addition mode.",
                                                    {
                                                        autoClose: 3000,
                                                    },
                                                );
                                            }
                                        } else {
                                            additionalMapGeoLocations.set(
                                                $additionalMapGeoLocations.filter(
                                                    (x) =>
                                                        x.location.properties
                                                            .osm_id !==
                                                        location.location
                                                            .properties.osm_id,
                                                ),
                                            );
                                        }

                                        mapGeoJSON.set(null);
                                        polyGeoJSON.set(null);
                                        questions.set([...questions.get()]);
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <Separator className="h-[0.5px]" />
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search place..."
                        onKeyUp={(x) => {
                            setInputValue(x.currentTarget.value);
                        }}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {loading ? (
                                <>Loading...</>
                            ) : error ? (
                                <>
                                    <a
                                        href="https://github.com/komoot/photon"
                                        className="text-blue-500"
                                    >
                                        Photon
                                    </a>{" "}
                                    is down. Please draw a polygon instead at
                                    the bottom left of the map.
                                </>
                            ) : (
                                "No locations found."
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {results.map((result) => (
                                <CommandItem
                                    key={`${result.properties.osm_id}${result.properties.name}`}
                                    onSelect={() => {
                                        additionalMapGeoLocations.set([
                                            ...additionalMapGeoLocations.get(),
                                            {
                                                added: true,
                                                location: result,
                                                base: false,
                                            },
                                        ]);

                                        mapGeoJSON.set(null);
                                        polyGeoJSON.set(null);
                                        questions.set([...questions.get()]);
                                    }}
                                    className="cursor-pointer"
                                >
                                    {determineName(result)}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    {$developerMode && (
                        <Button
                            variant="outline"
                            className="font-normal bg-slate-50 hover:bg-slate-200"
                            onClick={() => {
                                mapGeoJSON.set(null);
                                polyGeoJSON.set(null);
                                questions.set([]);
                                clearCache(CacheType.ZONE_CACHE);
                            }}
                        >
                            Clear Questions & Cache
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        className="font-normal bg-blue-50 hover:bg-blue-200"
                        onClick={() => {
                            // Restore DC default hiding zone
                            const dcDefaultLocation: OpenStreetMap = {
                                geometry: {
                                    coordinates: [-77.185135, 38.753012],
                                    type: "Point",
                                },
                                type: "Feature",
                                properties: {
                                    osm_type: "R",
                                    osm_id: 2826811,
                                    extent: [-77.538071, -76.797867, 38.753012, 39.141777],
                                    country: "United States",
                                    osm_key: "place",
                                    countrycode: "US",
                                    osm_value: "region",
                                    name: "Washington DC Area",
                                    type: "region",
                                },
                            };

                            const dcDefaultPolygon: FeatureCollection<Polygon> = {
                                "type": "FeatureCollection",
                                "features": [{
                                    "type": "Feature",
                                    "properties": {},
                                    "geometry": {
                                        "type": "Polygon",
                                        "coordinates": [[
                                            [-77.185135,38.753012],
                                            [-77.109604,38.76613],
                                            [-77.040596,38.788345],
                                            [-76.969185,38.821789],
                                            [-76.896057,38.806005],
                                            [-76.797867,38.917483],
                                            [-76.865501,38.980763],
                                            [-76.884727,39.03572],
                                            [-77.050896,39.08637],
                                            [-77.162132,39.141777],
                                            [-77.210541,39.126864],
                                            [-77.149086,38.975158],
                                            [-77.213974,38.946059],
                                            [-77.505112,39.030653],
                                            [-77.538071,39.000776],
                                            [-77.45945,38.926832],
                                            [-77.330017,38.910537],
                                            [-77.289505,38.852275],
                                            [-77.185135,38.753012]
                                        ]]
                                    }
                                }]
                            };

                            mapGeoLocation.set(dcDefaultLocation);
                            polyGeoJSON.set(dcDefaultPolygon);
                            mapGeoJSON.set(null);
                            additionalMapGeoLocations.set([]);
                            questions.set([]);
                            clearCache(CacheType.ZONE_CACHE);
                            
                            toast.success("Restored Washington DC default hiding zone", {
                                autoClose: 2000,
                            });
                        }}
                    >
                        Restore DC Default
                    </Button>
                    {$polyGeoJSON && $developerMode && (
                        <Button
                            variant="outline"
                            className="font-normal hover:bg-slate-200"
                            onClick={() => {
                                polyGeoJSON.set(null);
                                mapGeoJSON.set(null);
                                questions.set([...questions.get()]);
                            }}
                        >
                            Reuse Preset Locations
                        </Button>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
};
