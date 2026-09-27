import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const images: NextConfig["images"] = { unoptimized: true, remotePatterns: [{ protocol: "https", hostname: "**" }] };

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return { output: "export", images };
  // En dev, `pnpm dev:functions` sert les Netlify Functions sur :9999 ; next dev leur relaie les appels.
  return {
    images,
    rewrites: async () => [{ source: "/.netlify/functions/:path*", destination: "http://localhost:9999/.netlify/functions/:path*" }],
  };
}
