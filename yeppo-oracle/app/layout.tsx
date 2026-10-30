import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/config";
import { display, mono, sans } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo oracle · see the future of any memecoin",
  description:
    "Paste any pump.fun coin and see what happened next to the 30 coins that looked exactly like it. Live holders by habit, sell pressure clock and a play-by-play of every big move. Free.",
  openGraph: {
    title: "yeppo oracle · see the future of any memecoin",
    description: "What happened next to the 30 coins that looked exactly like yours. Free, live, no wallet.",
    url: SITE_URL,
    siteName: "yeppo",
  },
  twitter: { card: "summary_large_image", title: "yeppo oracle", description: "See the future of any memecoin." },
};

export const viewport: Viewport = { themeColor: "#06070b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <div className="bg">
          <div className="grid" />
        </div>
        {children}
      </body>
    </html>
  );
}
