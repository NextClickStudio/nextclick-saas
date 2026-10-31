import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { GUIDES } from "@/lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    page("", 1, "weekly"),
    page("/extension", 0.9, "weekly"),
    page("/pricing", 0.8, "monthly"),
    page("/trends", 0.8, "hourly"),
    page("/learn", 0.8, "weekly"),
    ...GUIDES.map((g) => page(`/learn/${g.slug}`, 0.7, "monthly")),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/risk", 0.3, "yearly"),
  ];
}
