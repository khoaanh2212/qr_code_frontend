"use client";

import { useEffect } from "react";
import type { Locale } from "@/i18n/config";
import { sessionApi } from "@/lib/api";
import { afterLoginTarget } from "./login-form";

/** On login and sign-up pages: someone already logged in goes straight on. */
export function RedirectIfSignedIn({ locale }: { locale: Locale }) {
  useEffect(() => {
    const abort = new AbortController();
    sessionApi
      .request("/v1/me", { signal: abort.signal })
      .then(() => window.location.replace(afterLoginTarget(locale)))
      .catch(() => {}); // logged out (401) or unreachable: stay on the form
    return () => abort.abort();
  }, [locale]);
  return null;
}
