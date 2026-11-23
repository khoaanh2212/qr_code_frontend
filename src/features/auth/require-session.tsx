"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ApiError, sessionApi } from "@/lib/api";
import type { MeResponse, User } from "@/lib/api/types";

const SessionContext = createContext<User | null>(null);

/** The logged-in user; only usable below <RequireSession>. */
export function useUser(): User {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useUser must be used below <RequireSession>");
  return user;
}

type State = { kind: "loading" } | { kind: "ready"; user: User } | { kind: "error" };

/** Full page load to the login page (it uses the other root layout anyway). */
export function redirectToLogin(): void {
  const here = window.location.pathname + window.location.search;
  window.location.replace(`/login?return_to=${encodeURIComponent(here)}`);
}

/**
 * Loads the session from `GET /v1/me`. Logged-out visitors are sent to the login page with a
 * `return_to` back here. This is a convenience, not a security boundary: the API authorizes
 * every request itself, and server components under /app must not fetch per-user data.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
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

  if (state.kind === "loading") return <p className="p-4 text-sm">Loading…</p>;
  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-2 p-4 text-sm">
        <p role="alert">We could not load your account.</p>
        <button
          type="button"
          className="underline"
          onClick={() => {
            setState({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  return <SessionContext.Provider value={state.user}>{children}</SessionContext.Provider>;
}
