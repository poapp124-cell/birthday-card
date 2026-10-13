"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "birthday-card-appearance";
const themes = ["sakura", "mint", "sky", "yellow", "lavender"];
const fontSizes = ["system", "smallest", "small", "standard", "large", "largest"];
const AppearanceContext = createContext(null);
const defaultAppearance = { theme: "sakura", fontSize: "system" };
let cachedAppearance = defaultAppearance;
let hasLoaded = false;
const listeners = new Set();

function applyAppearance(theme, fontSize) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.fontSize = fontSize;
}

function loadAppearance() {
  if (hasLoaded || typeof window === "undefined") return cachedAppearance;
  hasLoaded = true;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    cachedAppearance = {
      theme: themes.includes(stored.theme) ? stored.theme : "sakura",
      fontSize: fontSizes.includes(stored.fontSize) ? stored.fontSize : "system",
    };
  } catch (error) {
    console.error("外観設定を読み込めませんでした。", error);
    cachedAppearance = defaultAppearance;
  }
  return cachedAppearance;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return loadAppearance();
}

function getServerSnapshot() {
  return defaultAppearance;
}

function updateAppearance(change) {
  cachedAppearance = { ...cachedAppearance, ...change };
  hasLoaded = true;
  applyAppearance(cachedAppearance.theme, cachedAppearance.fontSize);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedAppearance));
  } catch (error) {
    console.error("外観設定を保存できませんでした。", error);
  }
  listeners.forEach((listener) => listener());
}

export function AppearanceProvider({ children }) {
  const appearance = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    applyAppearance(appearance.theme, appearance.fontSize);
  }, [appearance]);

  const value = {
    ...appearance,
    setTheme: useCallback((theme) => {
      if (!themes.includes(theme)) return;
      updateAppearance({ theme });
    }, []),
    setFontSize: useCallback((fontSize) => {
      if (!fontSizes.includes(fontSize)) return;
      updateAppearance({ fontSize });
    }, []),
  };

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within AppearanceProvider");
  }
  return context;
}
