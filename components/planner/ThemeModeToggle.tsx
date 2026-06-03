"use client";

import { useEffect, useState } from "react";

import {
  appThemePreferenceStorageKey,
  AppThemeMode,
  defaultAppTheme,
  getSystemAppThemeMode,
  parseAppThemeMode,
  readStoredAppThemeMode,
} from "@/lib/theme";

const applyThemeMode = (mode: AppThemeMode) => {
  document.documentElement.dataset.theme = mode;
};

const getDocumentThemeMode = (): AppThemeMode =>
  parseAppThemeMode(document.documentElement.dataset.theme) ?? defaultAppTheme.mode;

const getResolvedBrowserThemeMode = (): AppThemeMode =>
  readStoredAppThemeMode(window.localStorage) ?? getSystemAppThemeMode(window.matchMedia);

const getInitialThemeMode = (): AppThemeMode => {
  if (typeof document === "undefined") {
    return defaultAppTheme.mode;
  }

  return getDocumentThemeMode();
};

const Icon = ({ mode }: { mode: AppThemeMode }) => {
  if (mode === "dark") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M20 14.5A7.5 7.5 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
};

export default function ThemeModeToggle() {
  const [mode, setMode] = useState<AppThemeMode>(getInitialThemeMode);

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
      className="planner-button-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-brand-primary transition"
    >
      <Icon mode={mode} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
