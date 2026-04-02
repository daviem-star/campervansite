import type { Metadata } from "next";

import { rootThemeAttributes } from "@/lib/theme";

import "./globals.css";

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
    >
      <body>{children}</body>
    </html>
  );
}
