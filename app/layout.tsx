import type { Metadata } from "next";
import "./globals.css";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AppProviders } from "@/components/providers/app-providers";
import { getSiteUrl } from "@/lib/site-url";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "AgroTruck — Encontre um truck disponível", template: "%s | AgroTruck" },
  description: "Encontre trucks disponíveis na Guiné-Bissau e contacte diretamente os proprietários por WhatsApp ou telefone.",
  applicationName: "AgroTruck",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/agrotruck-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "AgroTruck", statusBarStyle: "default" },
  openGraph: { title: "AgroTruck", description: "Trucks disponíveis. Contacto direto.", images: ["/brand/agrotruck-lockup.png"], type: "website", locale: "pt_GW" },
};

export const viewport = { themeColor: "#0B3D2E", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body>
        <AppProviders>
          <AnimatedBackground />
          <PwaRegister />
          <Navbar />
          {children}
          <Footer />
          <Analytics />
        </AppProviders>
      </body>
    </html>
  );
}
