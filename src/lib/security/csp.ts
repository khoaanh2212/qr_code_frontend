/**
 * Content Security Policy for the two surfaces of the site (see README, "Site structure").
 *
 * - "private": the logged-in app and the auth pages. Rendered per request, so scripts are
 *   allowed only with a per-request nonce ('strict-dynamic' lets those scripts load chunks).
 * - "marketing": public pages, prerendered and cached at the CDN. A nonce would be frozen into
 *   the cached HTML, so these pages cannot use one; Next.js inlines its RSC payload as inline
 *   scripts, hence 'unsafe-inline'. These pages must never render user-supplied content.
 */

import { splitLocale } from "@/i18n/config";

export type Surface = "marketing" | "private";

/**
 * Path prefixes rendered as "private", without the locale prefix. Matched on whole segments:
 * "/app" but not "/apple"; "/vi/app" is private too.
 */
export const PRIVATE_PREFIXES = [
  "/app",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
] as const;

export function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

/** The surface of a public URL path, with or without a locale prefix. */
export function surfaceFor(pathname: string): Surface {
  return isPrivatePath(splitLocale(pathname).rest) ? "private" : "marketing";
}

/** Private pages that show the Turnstile check (sign-up, password reset request, resend). */
export const CAPTCHA_PATHS = ["/register", "/forgot-password", "/verify-email"] as const;

/** Whether a URL path (with or without a locale prefix) hosts the Turnstile iframe. */
export function hostsCaptcha(pathname: string): boolean {
  const { rest } = splitLocale(pathname);
  return CAPTCHA_PATHS.some((p) => rest === p || rest === `${p}/`);
}

export interface CspOptions {
  surface: Surface;
  /** Allow the Turnstile iframe (only on CAPTCHA_PATHS). */
  captcha?: boolean;
  /** Required for "private"; ignored for "marketing". */
  nonce?: string;
  /** Origin of the API (scheme://host[:port]), allowed for fetch and QR preview images. */
  apiOrigin: string;
  /** Development needs 'unsafe-eval' (React debugging). */
  dev: boolean;
}

const NONCE = /^[A-Za-z0-9+/=_-]{8,}$/;

/** Origin of Cloudflare Turnstile's script and iframe. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function checkOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`CSP: API origin is not a URL: ${JSON.stringify(value)}`);
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin !== value) {
    throw new Error(`CSP: API origin must be a bare http(s) origin: ${JSON.stringify(value)}`);
  }
  return url.origin;
}

export function buildCsp({ surface, captcha = false, nonce, apiOrigin, dev }: CspOptions): string {
  const api = checkOrigin(apiOrigin);

  let scripts: string[];
  if (surface === "private") {
    if (!nonce || !NONCE.test(nonce)) throw new Error("CSP: private pages need a valid nonce");
    scripts = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  } else {
    scripts = ["'self'", "'unsafe-inline'"];
  }
  if (dev) scripts.push("'unsafe-eval'");

  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    ["script-src", ...scripts],
    // Inline styles stay allowed: React and Next.js emit style attributes, and CSS injection is
    // a far smaller risk than script injection.
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:", api],
    ["font-src", "'self'"],
    ["connect-src", "'self'", api],
    // Only the pages with the Cloudflare Turnstile check frame anything (its iframe).
    surface === "private" && captcha ? ["frame-src", TURNSTILE_ORIGIN] : ["frame-src", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'none'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  // Only when the API itself is on https: a local production build talks to http://localhost.
  if (api.startsWith("https:")) directives.push(["upgrade-insecure-requests"]);

  return directives.map((d) => d.join(" ")).join("; ");
}
