import * as React from "react";
import { cn } from "@/lib/utils";

type Options<T extends string> = Partial<Record<T, string>>;

interface MobileSelectProps<T extends string> {
    trigger: string | Record<"className" | "placeholder", string>;
    options?: Options<T>;
    groups?: Record<
        string,
        { disabled: boolean; options: Options<T> } | Options<T>
    >;
    onValueChange?: (value: T) => void;
    value: T;
    disabled?: boolean;
}

export const MobileSelect = <T extends string>({
    trigger,
    options,
    groups,
    onValueChange,
    value,
    disabled,
}: MobileSelectProps<T>) => {
    const { placeholder, className } =
        typeof trigger === "string" ? { placeholder: trigger } : trigger;

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (onValueChange) {
            onValueChange(event.target.value as T);
        }
    };

    const renderOptions = (opts: Options<T>, groupDisabled = false) => {
        return Object.entries(opts).map(([key, label]) => (
            <option
                key={key}
                value={key}
                disabled={groupDisabled}
            >
                {String(label)}
            </option>
        ));
    };

    return (
        <div className="relative">
            <select
                value={value}
                onChange={handleChange}
                disabled={disabled}
                aria-label={placeholder}
                className={cn(
                    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    "appearance-none cursor-pointer",
                    className
                )}
            >
                {placeholder && !value && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options && renderOptions(options)}
                {groups && Object.entries(groups).map(([groupName, groupConfig]) => {
                    const isConfigObject = "options" in groupConfig && typeof groupConfig.options === "object";
                    const groupOptions = isConfigObject ? groupConfig.options : groupConfig as Options<T>;
                    const groupDisabled = isConfigObject ? groupConfig.disabled : false;
                    
                    return (
                        <optgroup key={groupName} label={groupName}>
                            {renderOptions(groupOptions, groupDisabled)}
                        </optgroup>
                    );
                })}
            </select>
            {/* Custom arrow icon */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg
                    className="h-4 w-4 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 10l5 5 5-5"
                    />
                </svg>
            </div>
        </div>
    );
};
