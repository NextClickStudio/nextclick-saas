import type { Metadata, Viewport } from "next";
import { DM_Mono, Figtree } from "next/font/google";
import { GameProvider } from "@/lib/game/store";
import "./globals.css";

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const mono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Maison · the fashion trend market",
  description: "Every fashion trend has a price, live from Google searches. Collect, trade and call the trends. The richest maison wins the week.",
  applicationName: "Maison",
  appleWebApp: { capable: true, title: "Maison", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">
        <GameProvider>{children}</GameProvider>
      </body>
    </html>
  );
}
