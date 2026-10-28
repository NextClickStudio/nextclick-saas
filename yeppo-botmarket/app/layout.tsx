import type { Metadata, Viewport } from "next";
import AppProvider from "@/components/AppProvider";
import AuthModal from "@/components/AuthModal";
import FxLayer from "@/components/FxLayer";
import TopNav from "@/components/TopNav";
import { SITE_URL } from "@/lib/config";
import { mono, sans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "yeppo botmarket — the stock market for trading bots", template: "%s · yeppo botmarket" },
  description: "Build a trading bot in 30 seconds. It trades the real market with paper money, 24/7. Buy shares of the best bots and earn dividends on every winning trade.",
  openGraph: {
    title: "yeppo botmarket",
    description: "The stock market for trading bots. Real prices, paper money, live PnL, dividends.",
    url: SITE_URL,
    siteName: "yeppo",
  },
  twitter: { card: "summary_large_image", title: "yeppo botmarket" },
};

export const viewport: Viewport = { themeColor: "#08090a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AppProvider>
          <TopNav />
          {children}
          <AuthModal />
        </AppProvider>
        <FxLayer />
      </body>
    </html>
  );
}
