"use client";

import { Monitor, RotateCw, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { authFailure } from "@/features/auth/form-rules";
import { FormAlert } from "@/components/form/form-bits";
import { format, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError, sessionApi } from "@/lib/api";
import { revokeSession } from "./api";
import { formatRelative } from "@/lib/format/time";
import { describeUserAgent } from "@/lib/user-agent";
import { SavedNote, Section } from "./section";

type T = Messages["account"];
type AuthT = Messages["auth"];

export interface DeviceSession {
  id: string;
  user_agent: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
}

type State = { kind: "loading" } | { kind: "ready"; sessions: DeviceSession[] } | { kind: "error"; error: unknown };

const MOBILE = new Set(["iOS", "iPadOS", "Android"]);

function deviceLabel(t: T, ua: string): string {
  const name = describeUserAgent(ua);
  if (!name) return t.unknownDevice;
  return name.os ? format(t.browserOn, { browser: name.browser, os: name.os }) : name.browser;
}

export function Devices({ t, auth, locale }: { t: T; auth: AuthT; locale: Locale }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>();
  const [alert, setAlert] = useState<string>();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    sessionApi
      .request<{ sessions: DeviceSession[] }>("/v1/me/sessions", { signal: abort.signal })
      .then(({ sessions }) => setState({ kind: "ready", sessions }))
      .catch((error: unknown) => {
        if (abort.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) return redirectToLogin();
        setState({ kind: "error", error });
      });
    return () => abort.abort();
  }, [attempt]);

  const drop = (id: string) => {
    setState((prev) => (prev.kind === "ready" ? { kind: "ready", sessions: prev.sessions.filter((s) => s.id !== id) } : prev));
    // The row (and the button that had focus) is gone: continue from the list.
    requestAnimationFrame(() => listRef.current?.focus());
  };

  async function logOut(session: DeviceSession) {
    if (busyId) return;
    setBusyId(session.id);
    setNotice(undefined);
    setAlert(undefined);
    try {
      await revokeSession(session.id);
      drop(session.id);
      setNotice(format(t.deviceLoggedOutNamed, { device: deviceLabel(t, session.user_agent) }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      // Already gone (404): drop it from the list as well.
      if (err instanceof ApiError && err.status === 404) drop(session.id);
      else setAlert(authFailure(err, auth).message);
    } finally {
      setBusyId(null);
    }
  }

  /** Every session but this one, one request each (the API has no bulk call). */
  async function logOutOthers(others: DeviceSession[]) {
    if (busyId) return;
    setBusyId("others");
    setNotice(undefined);
    setAlert(undefined);
    const results = await Promise.allSettled(
      others.map((s) => revokeSession(s.id)),
    );
    const isGone = (r: PromiseSettledResult<void>) =>
      r.status === "fulfilled" || (r.reason instanceof ApiError && r.reason.status === 404);
    const failed = results.find((r): r is PromiseRejectedResult => !isGone(r));
    if (failed?.reason instanceof ApiError && failed.reason.status === 401) return redirectToLogin();
    const gone = new Set(others.filter((_, i) => isGone(results[i])).map((s) => s.id));
    setState((prev) => (prev.kind === "ready" ? { kind: "ready", sessions: prev.sessions.filter((s) => !gone.has(s.id)) } : prev));
    if (failed) setAlert(authFailure(failed.reason, auth).message);
    else setNotice(t.othersLoggedOut);
    setBusyId(null);
    requestAnimationFrame(() => listRef.current?.focus());
  }

  return (
    <Section title={t.devicesTitle} description={t.devicesIntro}>
      {state.kind === "loading" && (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{auth.working}</span>
          {[0, 1].map((i) => (
            <div key={i} aria-hidden="true" className="h-[4.5rem] animate-pulse rounded-lg bg-foreground/5" />
          ))}
        </div>
      )}
      {state.kind === "error" && (
        <div role="alert" className="flex flex-col items-start gap-3 text-sm">
          <p className="font-medium text-danger">{t.loadFailed}</p>
          <p className="text-muted">{authFailure(state.error, auth).message}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            <RotateCw aria-hidden="true" className="size-4" />
            {auth.retry}
          </Button>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          <ul
            ref={listRef}
            tabIndex={-1}
            aria-label={t.devicesTitle}
            className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface outline-none"
          >
            {state.sessions.map((s) => {
              const name = describeUserAgent(s.user_agent);
              const label = deviceLabel(t, s.user_agent);
              const Icon = name?.os && MOBILE.has(name.os) ? Smartphone : Monitor;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-muted" strokeWidth={1.75} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      <span className="break-words">{label}</span>
                      {s.current && (
                        <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-foreground">{t.thisDevice}</span>
                      )}
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>{format(t.lastActive, { when: formatRelative(s.last_seen_at, locale) })}</span>
                      <span>{format(t.loggedIn, { when: formatRelative(s.created_at, locale) })}</span>
                    </p>
                  </div>
                  {/* This device logs out from the header, like everywhere else in the app. */}
                  {!s.current && (
                    <Button
                      variant="secondary"
                      busy={busyId === s.id}
                      onClick={() => logOut(s)}
                      aria-label={format(t.logoutDeviceNamed, { device: label })}
                    >
                      {t.logoutDevice}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {state.sessions.some((s) => !s.current) && (
            <Button
              variant="secondary"
              className="self-start"
              busy={busyId === "others"}
              onClick={() => logOutOthers(state.sessions.filter((s) => !s.current))}
            >
              {t.logoutOthers}
            </Button>
          )}
        </>
      )}
      {/* Outcomes sit under the list, next to the action that caused them. */}
      <SavedNote message={notice} />
      <FormAlert message={alert} />
    </Section>
  );
}
