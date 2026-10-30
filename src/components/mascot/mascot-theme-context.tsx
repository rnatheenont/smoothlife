"use client";

import { createContext, useContext, type ReactNode } from "react";
import { mascotTheme, type MascotTheme, type MascotThemeSetting } from "./mascot-theme";

// The admin's outfit choice, read once on the server in the root layout and
// handed down, so every Smoothie on the page agrees from the first paint.

const MascotThemeContext = createContext<MascotThemeSetting>("auto");

export function MascotThemeProvider({ setting, children }: { setting: MascotThemeSetting; children: ReactNode }) {
  return <MascotThemeContext.Provider value={setting}>{children}</MascotThemeContext.Provider>;
}

/** The outfit to draw right now. */
export function useMascotTheme(): MascotTheme {
  return mascotTheme(useContext(MascotThemeContext));
}
