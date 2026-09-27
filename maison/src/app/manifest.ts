import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maison · learn fashion",
    short_name: "Maison",
    description: "Learn fashion in five minutes a day.",
    start_url: "/learn",
    display: "standalone",
    background_color: "#0e0e0d",
    theme_color: "#0e0e0d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
