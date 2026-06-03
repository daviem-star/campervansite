export const appBrands = ["campervan"] as const;
export type AppBrand = (typeof appBrands)[number];

export const appThemeModes = ["light", "dark"] as const;
export type AppThemeMode = (typeof appThemeModes)[number];

export const appThemePreferenceStorageKey = "campervansite:theme-mode";

export const defaultAppTheme = {
  brand: "campervan",
  mode: "light",
} as const satisfies {
  brand: AppBrand;
  mode: AppThemeMode;
};

export const rootThemeAttributes = {
  "data-brand": defaultAppTheme.brand,
  "data-theme": defaultAppTheme.mode,
} as const;

export const parseAppThemeMode = (value: unknown): AppThemeMode | null =>
  typeof value === "string" && appThemeModes.includes(value as AppThemeMode)
    ? (value as AppThemeMode)
    : null;

export const resolveAppThemeModePreference = (
  storedMode: unknown,
  systemPrefersDark: boolean,
): AppThemeMode => parseAppThemeMode(storedMode) ?? (systemPrefersDark ? "dark" : "light");

export const readStoredAppThemeMode = (storage: Storage | undefined): AppThemeMode | null => {
  if (!storage) {
    return null;
  }

  try {
    return parseAppThemeMode(storage.getItem(appThemePreferenceStorageKey));
  } catch {
    return null;
  }
};

export const getSystemAppThemeMode = (matchMedia: Window["matchMedia"] | undefined): AppThemeMode => {
  if (!matchMedia) {
    return defaultAppTheme.mode;
  }

  try {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return defaultAppTheme.mode;
  }
};
