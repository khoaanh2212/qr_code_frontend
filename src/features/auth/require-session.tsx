"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { localizePath, splitLocale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError, sessionApi } from "@/lib/api";
import type { MeResponse, User } from "@/lib/api/types";

interface Session {
  user: User;
  /** Replaces the cached user after an update (e.g. a new display name). */
  setUser: (user: User) => void;
}

const SessionContext = createContext<Session | null>(null);

function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("must be used below <RequireSession>");
  return session;
}

/** The logged-in user; only usable below <RequireSession>. */
export function useUser(): User {
  return useSession().user;
}

/** Updates the cached user after a change made through the API. */
export function useSetUser(): (user: User) => void {
  return useSession().setUser;
}

type State = { kind: "loading" } | { kind: "ready"; user: User } | { kind: "error" };

/** Full page load to the login page in the current language. */
export function redirectToLogin(): void {
  const here = window.location.pathname + window.location.search;
  const { locale } = splitLocale(window.location.pathname);
  window.location.replace(`${localizePath(locale, "/login")}?return_to=${encodeURIComponent(here)}`);
}

/**
 * Loads the session from `GET /v1/me`. Logged-out visitors are sent to the login page with a
 * `return_to` back here. This is a convenience, not a security boundary: the API authorizes
 * every request itself, and server components under /app must not fetch per-user data.
 */
export function RequireSession({
  messages: t,
  children,
}: {
  messages: Messages["session"];
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    sessionApi
      .request<MeResponse>("/v1/me", { signal: abort.signal })
      .then(({ user }) => setState({ kind: "ready", user }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          redirectToLogin();
          return;
        }
        setState({ kind: "error" });
      });
    return () => abort.abort();
  }, [attempt]);

  const setUser = useCallback((user: User) => setState({ kind: "ready", user }), []);
  const session = useMemo(() => (state.kind === "ready" ? { user: state.user, setUser } : null), [state, setUser]);

  if (state.kind === "loading") return <p className="p-4 text-sm">{t.loading}</p>;
  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-2 p-4 text-sm">
        <p role="alert">{t.loadFailed}</p>
        <button
          type="button"
          className="underline"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          {t.retry}
        </button>
      </div>
    );
  }
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
