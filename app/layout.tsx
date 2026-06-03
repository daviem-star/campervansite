import type { Metadata } from "next";

import {
  appThemePreferenceStorageKey,
  defaultAppTheme,
  rootThemeAttributes,
} from "@/lib/theme";

import "./globals.css";

const themeBootstrapScript = `
(() => {
  const root = document.documentElement;
  try {
    const storedMode = window.localStorage.getItem("${appThemePreferenceStorageKey}");
    const systemMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    root.dataset.brand = "${defaultAppTheme.brand}";
    root.dataset.theme = storedMode === "light" || storedMode === "dark" ? storedMode : systemMode;
  } catch {
    root.dataset.brand = "${defaultAppTheme.brand}";
    root.dataset.theme = "${defaultAppTheme.mode}";
  }
})();
`;

export const metadata: Metadata = {
  title: {
    default: "Campervan Trip Planner",
    template: "%s | Campervan Trip Planner",
  },
  description:
    "Plan campervan trips with stays, ferries, points of interest, and a map-first itinerary timeline.",
  applicationName: "Campervan Trip Planner",
  keywords: [
    "campervan",
    "trip planner",
    "itinerary",
    "ferry planning",
    "scotland islands",
    "route map",
    "next.js",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-brand={rootThemeAttributes["data-brand"]}
      data-theme={rootThemeAttributes["data-theme"]}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {children}
      </body>
    </html>
  );
}
