export const appBrands = ["campervan"] as const;
export type AppBrand = (typeof appBrands)[number];

export const appThemeModes = ["light", "dark"] as const;
export type AppThemeMode = (typeof appThemeModes)[number];

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
