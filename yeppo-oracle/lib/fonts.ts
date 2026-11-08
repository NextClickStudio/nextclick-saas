import { IBM_Plex_Mono, Schibsted_Grotesk } from "next/font/google";

// The house type (8 Nov 2026): Schibsted Grotesk, a newspaper grotesk, for everything from the 9 px labels to the
// headline; IBM Plex Mono for every number, address and timestamp. `display` and `sans` are the same face (the
// variable names stay so the panel and the extension follow).
export const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
export const display = sans;
export const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "600"] });
