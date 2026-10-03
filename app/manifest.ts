// Yeppo installabile come app (schermata Home del telefono): serve anche per le notifiche su iPhone.
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yeppo",
    short_name: "Yeppo",
    description: "Il tuo commerciale AI: trova chi sta cercando quello che vendi.",
    start_url: "/app/radar",
    display: "standalone",
    background_color: "#05060a",
    theme_color: "#05060a",
    icons: [
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
