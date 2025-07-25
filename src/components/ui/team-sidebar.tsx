import { useStore } from "@nanostores/react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { atom } from "nanostores";
import * as React from "react";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { activeSidebarAtom, openSidebar, closeSidebar } from "@/lib/sidebar-coordination";

const SIDEBAR_COOKIE_NAME = "team-sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "t";

type TeamSidebarContextType = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean) => void;
    openMobile: boolean;
    setOpenMobile: (open: boolean) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
};

const TeamSidebarContextAtom = atom<TeamSidebarContextType>({
    state: "collapsed", // Default to closed
    open: false,
    setOpen: () => {},
    openMobile: false,
    setOpenMobile: () => {},
    isMobile: false,
    toggleSidebar: () => {},
});

const TeamSidebarProvider = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        defaultOpen?: boolean;
        open?: boolean;
        onOpenChange?: (open: boolean) => void;
    }
>(
    (
        {
            defaultOpen = false, // Default to closed for team sidebar
            open: openProp,
            onOpenChange: setOpenProp,
            className,
            style,
            children,
            ...props
        },
        ref,
    ) => {
        const isMobile = useIsMobile();
        const [openMobile, setOpenMobile] = React.useState(false);

        // This is the internal state of the sidebar.
        // We use openProp and setOpenProp for control from outside the component.
        const [_open, _setOpen] = React.useState(defaultOpen);
        const open = openProp ?? _open;
        const setOpen = React.useCallback(
            (value: boolean | ((value: boolean) => boolean)) => {
                const openState =
                    typeof value === "function" ? value(open) : value;
                if (setOpenProp) {
                    setOpenProp(openState);
                } else {
                    _setOpen(openState);
                }

                // Coordinate with other left sidebars
                if (openState) {
                    openSidebar("team");
                } else {
                    closeSidebar();
                }

                // This sets the cookie to keep the sidebar state.
                document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
            },
            [setOpenProp, open],
        );

        // Helper to toggle the sidebar.
        const toggleSidebar = React.useCallback(() => {
            return isMobile
                ? setOpenMobile((open) => !open)
                : setOpen((open) => !open);
        }, [isMobile, setOpen, setOpenMobile]);

        // Adds a keyboard shortcut to toggle the sidebar.
        React.useEffect(() => {
            const handleKeyDown = (event: KeyboardEvent) => {
                if (
                    event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
                    (event.metaKey || event.ctrlKey)
                ) {
                    event.preventDefault();
                    toggleSidebar();
                }
            };

            window.addEventListener("keydown", handleKeyDown);
            return () => window.removeEventListener("keydown", handleKeyDown);
        }, [toggleSidebar]);

        // Close this sidebar when another left sidebar becomes active
        React.useEffect(() => {
            const unsubscribe = activeSidebarAtom.subscribe((activeSidebar) => {
                if (activeSidebar !== "team" && activeSidebar !== null && open) {
                    _setOpen(false);
                }
            });
            
            return unsubscribe;
        }, [open]);

        // We add a state so that we can do data-state="expanded" or "collapsed".
        // This makes it easier to style the sidebar with Tailwind classes.
        const state = open ? "expanded" : "collapsed";

        React.useEffect(() => {
            TeamSidebarContextAtom.set({
                state,
                open,
                setOpen,
                isMobile,
                openMobile,
                setOpenMobile,
                toggleSidebar,
            });
        }, [
            state,
            open,
            setOpen,
            isMobile,
            openMobile,
            setOpenMobile,
            toggleSidebar,
        ]);

        return (
            <TooltipProvider delayDuration={0}>
                <div
                    style={
                        {
                            "--sidebar-width": SIDEBAR_WIDTH,
                            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                            ...style,
                        } as React.CSSProperties
                    }
                    className={cn(
                        "group/team-sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
                        className,
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </div>
            </TooltipProvider>
        );
    },
);
TeamSidebarProvider.displayName = "TeamSidebarProvider";

const TeamSidebar = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        side?: "left" | "right";
        variant?: "sidebar" | "floating" | "inset";
        collapsible?: "offcanvas" | "icon" | "none";
    }
>(
    (
        {
            side = "left",
            variant = "sidebar",
            collapsible = "offcanvas",
            className,
            children,
            ...props
        },
        ref,
    ) => {
        // eslint-disable-next-line prefer-const
        let { isMobile, state, openMobile, setOpenMobile } =
            useStore(TeamSidebarContextAtom);

        if (collapsible === "none") {
            return (
                <div
                    className={cn(
                        "flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground",
                        className,
                    )}
                    ref={ref}
                    {...props}
                >
                    {children}
                </div>
            );
        }

        if (isMobile) {
            return (
                <Sheet
                    open={openMobile}
                    onOpenChange={setOpenMobile}
                    {...props}
                >
                    <SheetContent
                        data-sidebar="sidebar"
                        data-mobile="true"
                        className="w-full bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden z-[1035]"
                        style={
                            {
                                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
                            } as React.CSSProperties
                        }
                        side={side}
                    >
                        <div className="flex h-full w-full flex-col">
                            {children}
                        </div>
                    </SheetContent>
                </Sheet>
            );
        }

        return (
            <div
                ref={ref}
                className="group peer hidden md:block text-sidebar-foreground"
                data-state={state}
                data-collapsible={state === "collapsed" ? collapsible : ""}
                data-variant={variant}
                data-side={side}
            >
                {/* This is what handles the sidebar gap on desktop */}
                <div
                    className={cn(
                        "duration-200 relative h-svh w-[--sidebar-width] bg-transparent transition-[width] ease-linear",
                        "group-data-[collapsible=offcanvas]:w-0",
                        "group-data-[side=right]:rotate-180",
                        variant === "floating" || variant === "inset"
                            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
                            : "group-data-[collapsible=icon]:w-[--sidebar-width-icon]",
                    )}
                />
                <div
                    className={cn(
                        "duration-200 fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] ease-linear md:flex",
                        side === "left"
                            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
                            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
                        // Adjust the padding for floating and inset variants.
                        variant === "floating" || variant === "inset"
                            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
                            : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l",
                        className,
                    )}
                    {...props}
                >
                    <div
                        data-sidebar="sidebar"
                        className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow"
                    >
                        {children}
                    </div>
                </div>
            </div>
        );
    },
);
TeamSidebar.displayName = "TeamSidebar";

const TeamSidebarTrigger = React.forwardRef<
    React.ElementRef<typeof Button>,
    React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useStore(TeamSidebarContextAtom);

    return (
        <button
            ref={ref}
            data-sidebar="trigger"
            className={cn(
                "bg-white hover:bg-[#f4f4f4] text-black rounded-sm border-2 border-black border-opacity-30 cursor-pointer py-1 px-2",
                "flex items-center gap-1",
                className,
            )}
            onClick={(event) => {
                onClick?.(event);
                toggleSidebar();
            }}
            {...props}
        >
            <Star className="w-4 h-4" />
        </button>
    );
});
TeamSidebarTrigger.displayName = "TeamSidebarTrigger";

export {
    TeamSidebar,
    TeamSidebarProvider,
    TeamSidebarTrigger,
    TeamSidebarContextAtom as TeamSidebarContext,
};
