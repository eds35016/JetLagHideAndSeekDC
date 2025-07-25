import { atom } from "nanostores";

export type LeftSidebarType = "questions" | "team" | null;

export const activeSidebarAtom = atom<LeftSidebarType>(null);

export const openSidebar = (sidebarType: LeftSidebarType) => {
    activeSidebarAtom.set(sidebarType);
};

export const closeSidebar = () => {
    activeSidebarAtom.set(null);
};

export const isActiveSidebar = (sidebarType: LeftSidebarType): boolean => {
    return activeSidebarAtom.get() === sidebarType;
};
