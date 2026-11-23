import { connection } from "next/server";

/**
 * Private pages (app and auth) must be rendered entirely per request: Next.js puts the CSP
 * nonce from src/proxy.ts only on scripts it renders at request time, and a prerendered static
 * shell would carry scripts without it, which the nonce-based policy blocks.
 *
 * Await this at the top of a private group layout, outside any <Suspense>, together with
 * `export const instant = false` (the segment is allowed to block). The whole route then
 * renders per request and has no static shell.
 */
export async function renderPerRequest(): Promise<void> {
  await connection();
}
