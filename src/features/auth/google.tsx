"use client";

import { useSyncExternalStore } from "react";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { config } from "@/lib/config";
import { safeReturnTo } from "@/lib/navigation/return-to";
import { FormAlert } from "@/components/form/form-bits";

/** The API's Google login error, set on /login by its callback (backend PLAN, "Google login"). */
export const GOOGLE_LOGIN_FAILED = "google_login_failed";

/**
 * Where "Continue with Google" goes: the API, which redirects to Google. A link, never a form
 * post or a fetch: `form-action 'self'` would block the redirect, and the API must set its own
 * state cookie on a top-level navigation.
 */
export function googleStartUrl({ returnTo, reauth = false }: { returnTo: string; reauth?: boolean }): string {
  const url = new URL("/v1/auth/google/start", config.apiBaseUrl);
  if (reauth) url.searchParams.set("intent", "reauth");
  url.searchParams.set("return_to", returnTo);
  return url.toString();
}

const noSubscribe = () => () => {};

/**
 * "Continue with Google" for the login and sign-up pages, with the page's `return_to` (checked
 * here again, the API checks it too) and the message of a failed Google login.
 */
export function GoogleSignIn({ t, locale, enabled = config.googleLogin }: { t: Messages["auth"]; locale: Locale; enabled?: boolean }) {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  if (!enabled) return null;
  const params = new URLSearchParams(search);
  const returnTo = safeReturnTo(params.get("return_to"), localizePath(locale, "/app"));
  const failed = params.get("error") === GOOGLE_LOGIN_FAILED;
  return (
    <div className="flex flex-col gap-4">
      {failed && <FormAlert message={t.googleFailed} />}
      <a
        href={googleStartUrl({ returnTo })}
        className="inline-flex min-h-12 items-center justify-center gap-3 rounded-md border border-control bg-surface px-4 font-semibold transition-colors duration-150 hover:bg-foreground/5"
      >
        <GoogleMark />
        {t.googleContinue}
      </a>
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        {t.orDivider}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/** Google's "G", as its sign-in branding guidelines ask buttons to show it. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
