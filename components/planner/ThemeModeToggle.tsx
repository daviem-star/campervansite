"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";

import {
  appThemePreferenceStorageKey,
  AppThemeMode,
  defaultAppTheme,
  getSystemAppThemeMode,
  readStoredAppThemeMode,
} from "@/lib/theme";

const applyThemeMode = (mode: AppThemeMode) => {
  document.documentElement.dataset.theme = mode;
};

const getResolvedBrowserThemeMode = (): AppThemeMode =>
  readStoredAppThemeMode(window.localStorage) ?? getSystemAppThemeMode(window.matchMedia);

const Icon = ({ mode }: { mode: AppThemeMode }) => {
  if (mode === "dark") {
    return <MoonStar className="h-4 w-4" aria-hidden="true" />;
  }

  return <SunMedium className="h-4 w-4" aria-hidden="true" />;
};

export default function ThemeModeToggle() {
  const [mode, setMode] = useState<AppThemeMode>(defaultAppTheme.mode);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const resolveCurrentPreference = () => {
      const nextMode = getResolvedBrowserThemeMode();
      setMode(nextMode);
      applyThemeMode(nextMode);
    };

    const syncSystemPreference = () => {
      if (readStoredAppThemeMode(window.localStorage)) {
        return;
      }

      const nextMode = getSystemAppThemeMode(window.matchMedia);
      setMode(nextMode);
      applyThemeMode(nextMode);
    };

    const syncStoredPreference = (event: StorageEvent) => {
      if (event.key && event.key !== appThemePreferenceStorageKey) {
        return;
      }

      const nextMode = getResolvedBrowserThemeMode();
      setMode(nextMode);
      applyThemeMode(nextMode);
    };

    window.addEventListener("storage", syncStoredPreference);
    mediaQuery.addEventListener("change", syncSystemPreference);
    const preferenceSyncTimer = window.setTimeout(resolveCurrentPreference, 0);

    return () => {
      window.clearTimeout(preferenceSyncTimer);
      window.removeEventListener("storage", syncStoredPreference);
      mediaQuery.removeEventListener("change", syncSystemPreference);
    };
  }, []);

  const nextMode: AppThemeMode = mode === "dark" ? "light" : "dark";
  const label = `Switch to ${nextMode} mode`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mode === "dark"}
      data-testid="theme-mode-toggle"
      title={label}
      onClick={() => {
        window.localStorage.setItem(appThemePreferenceStorageKey, nextMode);
        setMode(nextMode);
        applyThemeMode(nextMode);
      }}
      className="planner-button-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-brand-primary transition duration-200"
    >
      <Icon mode={mode} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
