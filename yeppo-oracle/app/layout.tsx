import type { Metadata, Viewport } from "next";
import "./y.css";
import Backdrop from "@/components/Backdrop";
import { SITE_URL } from "@/lib/config";
import { mono, sans } from "@/lib/fonts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "yeppo · know who made it. catch the move.",
  description: "Open any memecoin. In one second yeppo tells you if it's safe, what its creator did before, and if now is the moment.",
  openGraph: {
    title: "yeppo · know who made it. catch the move.",
    description: "Safety, creator history and the live moment of any memecoin, right on pump.fun, GMGN and Axiom.",
    url: SITE_URL,
    siteName: "yeppo",
  },
  twitter: { card: "summary_large_image", title: "yeppo", description: "Know who made it. Catch the move." },
};

export const viewport: Viewport = { themeColor: "#07060e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
