import type { Metadata } from "next";
import { baseMetadata, RootDocument } from "@/components/root-document";
import { renderPerRequest } from "@/features/auth/private-shell";
import { LOCALES } from "@/i18n/config";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = { ...baseMetadata, robots: { index: false, follow: false } };

// Allowed to block: rendered per request so every script carries the CSP nonce.
export const instant = false;

// Cache Components needs at least one value per root param; pages still render per request.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

/**
 * Root layout of the private pages (auth pages and the logged-in app): strict CSP with a
 * per-request nonce, no third-party scripts, `sessionApi` only.
 */
export default async function PrivateLayout({ children }: LayoutProps<"/[lang]">) {
  await renderPerRequest();
  return <RootDocument locale={await getLocale()}>{children}</RootDocument>;
}
