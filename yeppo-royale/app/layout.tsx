import type { Metadata, Viewport } from "next";
import "./globals.css";
import { display, mono, sans } from "@/lib/fonts";
import { SITE_URL } from "@/lib/config";
import AppProvider from "@/components/AppProvider";
import FxLayer from "@/components/FxLayer";
import Onboarding from "@/components/Onboarding";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo royale · the trading battle royale",
  description:
    "100 traders drop in with the same bag and trade replays of real pump.fun launches. Spot the rugs, ride the runners. Every cut, the poorest are eliminated. Free to play.",
  openGraph: {
    title: "yeppo royale",
    description: "The trading battle royale on real pump.fun launches. Free to play.",
    url: SITE_URL,
    siteName: "yeppo",
  },
  twitter: { card: "summary_large_image", title: "yeppo royale", description: "The trading battle royale on real pump.fun launches." },
};

export const viewport: Viewport = { themeColor: "#0a0b0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>
        <AppProvider>
          {children}
          <Onboarding />
        </AppProvider>
        <FxLayer />
      </body>
    </html>
  );
}
