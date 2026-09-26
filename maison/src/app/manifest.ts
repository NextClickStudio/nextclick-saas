import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maison · the fashion trend market",
    short_name: "Maison",
    description: "Every fashion trend has a price, live from Google searches.",
    start_url: "/today",
    display: "standalone",
    background_color: "#0e0e0d",
    theme_color: "#0e0e0d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
