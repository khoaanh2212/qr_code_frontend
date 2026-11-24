"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { localizePath, type Locale } from "@/i18n/config";
import { ApiError, sessionApi } from "@/lib/api";
import { authFailure, type AuthMessages } from "./form-rules";

/**
 * Ends this device's session and returns to the home page. Only a 401 (session already over)
 * counts as logged out; any other failure leaves the session alive, so it is shown, not hidden.
 */
export function LogoutButton({ t, locale }: { t: AuthMessages; locale: Locale }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const label = t.logout;
  return (
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="max-w-48 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        setError(undefined);
        try {
          await sessionApi.requestVoid("/v1/auth/logout", { method: "POST" });
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 401)) {
            setError(authFailure(err, t).message);
            setBusy(false);
            return;
          }
        }
        window.location.assign(localizePath(locale, "/"));
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-sm hover:bg-foreground/5 disabled:opacity-60"
    >
      <LogOut aria-hidden="true" className="size-4" />
      {/* Icon-only on phones, so long translations fit the header. */}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
    </div>
  );
}
