import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AnimatedBackground } from "@/components/shared/animated-background";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AppProviders } from "@/components/providers/app-providers";
import { getSiteUrl } from "@/lib/site-url";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "AgroTruck — Encontre um truck disponível", template: "%s | AgroTruck" },
  description: "Encontre trucks disponíveis na Guiné-Bissau e contacte diretamente os proprietários por WhatsApp ou telefone.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/agrotruck-mark.png" },
  openGraph: { title: "AgroTruck", description: "Trucks disponíveis. Contacto direto.", images: ["/brand/agrotruck-lockup.png"], type: "website", locale: "pt_GW" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt" className={poppins.variable} suppressHydrationWarning>
      <body>
        <AppProviders>
          <AnimatedBackground />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
