import type { MetadataRoute } from "next";

/** Lets phones install Oko to the home screen and open it like an app, even with no network. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oko: farm records",
    short_name: "Oko",
    description: "Run your farm: daily records, health, stock, sales and money. Works without network.",
    start_url: "/app?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f4ee",
    theme_color: "#0f2e21",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
