import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./v3.css";
import { SITE_URL } from "@/lib/config";
import { display, mono, sans } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo · know when to get in, know when to get out",
  description:
    "yeppo reads every new memecoin from its first trade: a plain-words verdict, the red flags, and an exit plan tested on the 30 coins that looked most like it. Right inside your trading site.",
  openGraph: {
    title: "yeppo · know when to get in, know when to get out",
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
