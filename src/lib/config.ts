/**
 * Public configuration. `NEXT_PUBLIC_*` values are inlined into the browser bundle at build
 * time, so they must never hold secrets.
 */

function origin(name: string, value: string | undefined, devDefault: string): string {
  if (value) {
    try {
      return new URL(value).origin;
    } catch {
      throw new Error(`${name} is not a URL: ${JSON.stringify(value)}`);
    }
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set for production builds`);
  }
  return devDefault;
}

/**
 * Cloudflare Turnstile site key. Required in production builds; in development it may be unset,
 * and the forms then skip the widget (a local API without a Turnstile secret ignores the token).
 */
function turnstileSiteKey(): string | null {
  const value = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY must be set for production builds");
  }
  return null;
}

export const config = {
  /** Origin of the Go API, e.g. https://api.example.com. */
  apiBaseUrl: origin("NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL, "http://localhost:8080"),
  /** Public origin of this site, for canonical URLs, the sitemap and robots.txt. */
  siteUrl: origin("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  /** Turnstile site key; null in development without one. */
  turnstileSiteKey: turnstileSiteKey(),
  /**
   * Shows "Continue with Google". Set NEXT_PUBLIC_GOOGLE_LOGIN=true only when the API has
   * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (its Google endpoints are 404 otherwise).
   */
  googleLogin: process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true",
} as const;
