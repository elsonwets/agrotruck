import { HeadContent, Outlet, Scripts, createRootRouteWithContext, useParams } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { DEFAULT_LANG, isLang } from "~/shared/domain";
import appCss from "~/styles/app.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b3d2e" },
      { name: "format-detection", content: "telephone=no" },
      { name: "application-name", content: "AgroTrucks" },
      { name: "apple-mobile-web-app-title", content: "AgroTrucks" },
    ],
    links: [
      { rel: "preload", href: "/fonts/poppins-400.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/poppins-600.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/brand/agrotruck-icon-192.png" },
      { rel: "apple-touch-icon", href: "/brand/agrotruck-icon-192.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const { lang } = useParams({ strict: false }) as { lang?: string };
  return (
    <html lang={isLang(lang) ? lang : DEFAULT_LANG}>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        <Outlet />
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}
