import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// The house type (7 Nov 2026): Archivo at its widest for headlines, like a printed report's display face; IBM Plex
// Sans for reading; IBM Plex Mono for every number, address and timestamp. The variable names stay the same so the
// panel and the extension pick the new faces up unchanged.
export const display = Archivo({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["wdth"] });
export const sans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400", "500", "600", "700"] });
export const mono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "600"] });
