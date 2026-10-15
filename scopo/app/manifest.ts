import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/learn",
    name: "Scopo · Learn by scrolling",
    short_name: "Scopo",
    description: "Short videos in the right order, starting where you are.",
    start_url: "/learn?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07070c",
    theme_color: "#07070c",
    categories: ["education", "entertainment"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
