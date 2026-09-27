import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { NotFound } from "~/components/not-found";
import { setConvexClient } from "~/lib/outbox-client";
import { SessionProvider } from "~/lib/session";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) throw new Error("VITE_CONVEX_URL manquant : lancez `pnpm dev:backend` ou définissez-le sur Vercel.");

  const convexQueryClient = new ConvexQueryClient(convexUrl);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
        gcTime: 5 * 60_000,
      },
    },
  });
  convexQueryClient.connect(queryClient);
  setConvexClient(convexQueryClient.convexClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0, // React Query + Convex gèrent le cache
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    Wrap: ({ children }) => (
      <ConvexProvider client={convexQueryClient.convexClient}>
        <SessionProvider>{children}</SessionProvider>
      </ConvexProvider>
    ),
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
