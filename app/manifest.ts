import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgroTrucks by Badora",
    short_name: "AgroTrucks",
    description: "La logistique de Badora et de son réseau de partenaires.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B3D2E",
    lang: "pt",
    orientation: "portrait-primary",
    categories: ["business", "transportation", "productivity"],
    icons: [
      { src: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/agrotruck-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/agrotruck-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
