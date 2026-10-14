import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
import "./globals.css";
import { SWRegister } from "@/components/SWRegister";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scopo-ten.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Scopo · Learn by scrolling", template: "%s · Scopo" },
  description:
    "Type anything you want to learn and get a vertical feed of short videos about that, and only that, in the language you choose.",
  applicationName: "Scopo",
  appleWebApp: { capable: true, title: "Scopo", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  // Versioni di iOS più vecchie riconoscono solo il meta con prefisso "apple-".
  other: { "apple-mobile-web-app-capable": "yes" },
  openGraph: {
    title: "Scopo · Learn by scrolling",
    description: "A feed of short videos on the one thing you want to learn.",
    siteName: "Scopo",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07070c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Le animazioni "reveal" partono nascoste solo se JavaScript è attivo. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
