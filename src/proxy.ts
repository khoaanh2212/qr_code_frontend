import { NextResponse, type NextRequest } from "next/server";
import { config as appConfig } from "@/lib/config";
import { buildCsp, surfaceFor } from "@/lib/security/csp";

/**
 * Sets the Content Security Policy per surface (see src/lib/security/csp.ts). Private pages get
 * a fresh nonce per request; Next.js reads it from the request's CSP header and puts it on its
 * own scripts. Private pages are also kept out of search engines.
 */
export function proxy(request: NextRequest) {
  const surface = surfaceFor(request.nextUrl.pathname);
  const nonce = surface === "private" ? newNonce() : undefined;
  const csp = buildCsp({
    surface,
    nonce,
    apiOrigin: appConfig.apiBaseUrl,
    dev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (surface === "private") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export const config = {
  matcher: [
    // Every request except static assets, including prefetches: a request carrying a prefetch
    // header must not get a private page without its CSP and no-store.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
