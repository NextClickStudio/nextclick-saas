import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

// Pagine pubbliche da far trovare a Google (report privati e area riservata esclusi, vedi robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/registrati`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/termini`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/cookie`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
