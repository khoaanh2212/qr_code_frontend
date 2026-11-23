import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { Locale } from "@/i18n/config";
import { config } from "@/lib/config";
import "@/styles/globals.css";
import { SITE_NAME } from "@/lib/site";

// Fonts are downloaded at build time and served from this site (CSP font-src 'self').
// latin-ext covers Vietnamese, German, French, Spanish and Portuguese diacritics.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });

export const baseMetadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
};

/**
 * The <html> and <body> shared by the two root layouts, (marketing) and (private). Having two
 * root layouts is deliberate: navigating between them is always a full page load, so a page
 * never keeps the other surface's Content Security Policy after a client-side navigation.
 */
export function RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
