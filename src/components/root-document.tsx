import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { config } from "@/lib/config";
import "@/styles/globals.css";

// Fonts are downloaded at build time and served from this site (CSP font-src 'self').
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const baseMetadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: { default: "QR Code Generator", template: "%s | QR Code Generator" },
  description: "Create free QR codes for links, Wi-Fi, contacts and more.",
};

/**
 * The <html> and <body> shared by the two root layouts, (marketing) and (private). Having two
 * root layouts is deliberate: navigating between them is always a full page load, so a page
 * never keeps the other surface's Content Security Policy after a client-side navigation.
 */
export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
