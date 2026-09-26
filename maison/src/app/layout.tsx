import type { Metadata, Viewport } from "next";
import { Anton, Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";

const display = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "700", "900"],
});

const poster = Anton({
  variable: "--font-poster",
  subsets: ["latin"],
  weight: "400",
});

const sans = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Maison",
  description: "Open your daily pack, build collections, read the trends before everyone else.",
};

export const viewport: Viewport = {
  themeColor: "#f4efe6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${poster.variable} ${sans.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
