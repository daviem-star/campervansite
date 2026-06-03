import { describe, expect, it } from "vitest";

import {
  appThemePreferenceStorageKey,
  getSystemAppThemeMode,
  parseAppThemeMode,
  readStoredAppThemeMode,
  resolveAppThemeModePreference,
} from "@/lib/theme";

const createStorageStub = (initialValue: string | null): Storage =>
  ({
    getItem: (key: string) => (key === appThemePreferenceStorageKey ? initialValue : null),
  }) as Storage;

describe("theme", () => {
  it("parses only supported app theme modes", () => {
    expect(parseAppThemeMode("light")).toBe("light");
    expect(parseAppThemeMode("dark")).toBe("dark");
    expect(parseAppThemeMode("system")).toBeNull();
    expect(parseAppThemeMode(null)).toBeNull();
  });

  it("prefers a valid stored mode over system preference", () => {
    expect(resolveAppThemeModePreference("light", true)).toBe("light");
    expect(resolveAppThemeModePreference("dark", false)).toBe("dark");
  });

  it("falls back to system preference when storage is absent or invalid", () => {
    expect(resolveAppThemeModePreference(null, true)).toBe("dark");
    expect(resolveAppThemeModePreference("nope", false)).toBe("light");
  });

  it("reads only valid stored preferences", () => {
    expect(readStoredAppThemeMode(createStorageStub("dark"))).toBe("dark");
    expect(readStoredAppThemeMode(createStorageStub("system"))).toBeNull();
    expect(readStoredAppThemeMode(undefined)).toBeNull();
  });

  it("resolves system mode defensively", () => {
    const prefersDark = (() => ({ matches: true })) as Window["matchMedia"];
    const prefersLight = (() => ({ matches: false })) as Window["matchMedia"];

    expect(getSystemAppThemeMode(prefersDark)).toBe("dark");
    expect(getSystemAppThemeMode(prefersLight)).toBe("light");
    expect(getSystemAppThemeMode(undefined)).toBe("light");
  });
});
