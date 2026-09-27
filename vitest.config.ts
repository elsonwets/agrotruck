import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // Environnement proche du runtime Convex (convex-test) ; suffisant aussi pour les règles partagées.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["src/**/*.test.ts", "convex/**/*.test.ts"],
  },
});
