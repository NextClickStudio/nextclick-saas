import type { Metadata, Viewport } from "next";
import { DM_Mono, Figtree } from "next/font/google";
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
  title: "Maison",
  description: "Open your daily pack, build collections, read the trends before everyone else.",
};

export const viewport: Viewport = {
  themeColor: "#0e0e0d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
