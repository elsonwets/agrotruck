import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgroTruck",
    short_name: "AgroTruck",
    description: "Encontre trucks disponíveis e contacte diretamente os proprietários.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B3D2E",
    lang: "pt",
    icons: [
      { src: "/brand/agrotruck-mark.png", sizes: "1080x585", type: "image/png", purpose: "any" },
    ],
  };
}
