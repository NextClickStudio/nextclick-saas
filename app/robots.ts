import type { MetadataRoute } from "next";

// I report privati e l'area riservata non devono finire sui motori di ricerca.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/r/", "/app", "/api/", "/login"] } };
}
