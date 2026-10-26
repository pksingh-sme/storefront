import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { getSettings } from "@/server/catalog";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-cormorant", display: "swap" });
const sans = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });

// The store is database-driven; render per request (data is cached with tags) so builds never need a database.
export const dynamic = "force-dynamic";

const siteUrl = process.env.SITE_URL || "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: settings.tagline ? `${settings.storeName} — ${settings.tagline}` : settings.storeName, template: `%s | ${settings.storeName}` },
    description: settings.storeDescription ?? undefined,
    openGraph: { siteName: settings.storeName, type: "website", locale: "en_US" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf8f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
