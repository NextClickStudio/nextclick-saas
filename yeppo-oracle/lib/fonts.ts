import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";

// a medium-weight grotesk for everything, a mono for numbers (the noiz.bio direction the user picked)
export const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap", weight: ["400", "500", "600", "700"] });
export const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", weight: ["400", "500", "700"] });
