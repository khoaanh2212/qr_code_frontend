import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, splitLocale } from "@/i18n/config";
import { config as appConfig } from "@/lib/config";
import { buildCsp, hostsCaptcha, surfaceFor } from "@/lib/security/csp";

/**
 * 1. Locale routing: every route lives under app/[lang]. English URLs carry no prefix, so
 *    "/login" is rewritten to "/en/login"; "/en/login" redirects to "/login" so each page has
 *    one URL. Other locales ("/vi/login") pass through. No redirect based on Accept-Language:
 *    pages stay cacheable and crawlers see what they asked for.
 * 2. Content Security Policy per surface (see src/lib/security/csp.ts). Private pages get a
 *    fresh nonce per request; Next.js reads it from the request's CSP header and puts it on its
 *    own scripts. Private pages are also kept out of search engines and shared caches.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, rest, explicit } = splitLocale(pathname);

  // Metadata images are linked as /en/opengraph-image-…: serve them, a redirected og:image is
  // flaky in link previews.
  const metadataImage = /^\/(opengraph-image|twitter-image)[^/]*$/.test(rest);
  if (explicit && locale === DEFAULT_LOCALE && !metadataImage) {
    const url = request.nextUrl.clone();
    url.pathname = rest;
    return NextResponse.redirect(url, 308);
  }

  const surface = surfaceFor(pathname);
  const nonce = surface === "private" ? newNonce() : undefined;
  const csp = buildCsp({
    surface,
    captcha: hostsCaptcha(pathname),
    nonce,
    apiOrigin: appConfig.apiBaseUrl,
    filesOrigin: appConfig.filesBaseUrl,
    dev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  if (nonce) requestHeaders.set("x-nonce", nonce);
  const init = { request: { headers: requestHeaders } };

  let response: NextResponse;
  if (explicit) {
    response = NextResponse.next(init);
  } else {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
    response = NextResponse.rewrite(url, init);
  }

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
    // Root metadata files (icon, apple-icon) live outside app/[lang] and must not be rewritten.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|robots.txt|sitemap.xml).*)",
  ],
};
