import type { Metadata } from "next";
import { baseMetadata, RootDocument } from "@/components/root-document";
import { renderPerRequest } from "@/features/auth/private-shell";

export const metadata: Metadata = { ...baseMetadata, robots: { index: false, follow: false } };

// Allowed to block: rendered per request so every script carries the CSP nonce.
export const instant = false;

/**
 * Root layout of the private pages (auth pages and the logged-in app): strict CSP with a
 * per-request nonce, no third-party scripts, `sessionApi` only.
 */
export default async function PrivateLayout({ children }: LayoutProps<"/">) {
  await renderPerRequest();
  return <RootDocument>{children}</RootDocument>;
}
