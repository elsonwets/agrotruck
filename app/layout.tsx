import type { Metadata } from "next";
import "./globals.css";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AppProviders } from "@/components/providers/app-providers";
import { getSiteUrl } from "@/lib/site-url";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { OfflineBanner } from "@/components/pwa/offline-banner";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "AgroTrucks by Badora — Location de camions", template: "%s | AgroTrucks by Badora" },
  description: "La logistique de Badora et de son réseau de partenaires, réunie au même endroit. Demandez une location de camions, sans prix affiché — le contact se fait ensuite directement.",
  applicationName: "AgroTrucks by Badora",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/agrotruck-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/agrotruck-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "AgroTrucks by Badora", statusBarStyle: "default" },
  openGraph: { title: "AgroTrucks by Badora", description: "La logistique de Badora et de ses partenaires, au même endroit.", images: ["/brand/agrotruck-lockup.png"], type: "website", locale: "pt_GW" },
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
          <OfflineBanner />
          {children}
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
