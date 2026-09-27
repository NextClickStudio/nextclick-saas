import type { Metadata, Viewport } from "next";
import { DM_Mono, Figtree } from "next/font/google";
import { LearnProvider } from "@/lib/learn/store";
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
  title: "Maison · learn fashion",
  description: "Learn fashion in five minutes a day: maisons, designers, icons, runways, fabrics and history. Duel your friends and climb the leagues.",
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
        <LearnProvider>{children}</LearnProvider>
      </body>
    </html>
  );
}
