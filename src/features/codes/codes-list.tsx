"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ButtonLink, FormAlert } from "@/features/auth/form-bits";
import { redirectToLogin, usePersonalWorkspace } from "@/features/auth/require-session";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { listCodes } from "./api";
import { StatusBadge } from "./status-badge";

type T = Messages["codes"];

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; codes: DynamicCode[]; next: string | null; loadingMore: boolean };

/** The dashboard: the personal workspace's dynamic codes, newest first. */
export function CodesList({ t, locale }: { t: T; locale: Locale }) {
  const workspace = usePersonalWorkspace();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!workspace) return;
    const abort = new AbortController();
    listCodes(workspace.id, undefined, abort.signal)
      .then((page) => setState({ kind: "ready", codes: page.codes, next: page.next_cursor, loadingMore: false }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setState({ kind: "error" });
      });
    return () => abort.abort();
  }, [workspace, attempt]);

  const [moreFailed, setMoreFailed] = useState(false);
  const loadMore = useCallback(async () => {
    if (!workspace || state.kind !== "ready" || !state.next) return;
    const cursor = state.next;
    setMoreFailed(false);
    setState((prev) => (prev.kind === "ready" ? { ...prev, loadingMore: true } : prev));
    try {
      const page = await listCodes(workspace.id, cursor);
      // Append only to the page this request continued (a retry may have replaced it).
      setState((prev) =>
        prev.kind === "ready" && prev.next === cursor
          ? { kind: "ready", codes: [...prev.codes, ...page.codes], next: page.next_cursor, loadingMore: false }
          : prev,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setMoreFailed(true);
      setState((prev) => (prev.kind === "ready" ? { ...prev, loadingMore: false } : prev));
    }
  }, [workspace, state]);

  const newHref = localizePath(locale, "/app/codes/new");
  // Every account has a personal workspace; without one there is nothing to load.
  const shown: State = !workspace ? { kind: "error" } : state;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="max-w-prose text-sm text-pretty text-muted">{t.intro}</p>
        </div>
        {shown.kind === "ready" && shown.codes.length > 0 && (
          <Link
            href={newHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t.newCode}
          </Link>
        )}
      </header>

      {shown.kind === "loading" && <p role="status" className="text-sm text-muted">{t.title}…</p>}
      {shown.kind === "error" && (
        <div className="flex flex-col items-start gap-2">
          <FormAlert message={t.loadFailed} />
          <button
            type="button"
            className="inline-flex min-h-11 items-center text-sm underline"
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </button>
        </div>
      )}
      {shown.kind === "ready" && shown.codes.length === 0 && (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-6">
          <p className="font-medium">{t.empty}</p>
          <p className="max-w-prose text-sm text-pretty text-muted">{t.emptyIntro}</p>
          <ButtonLink href={newHref}>{t.newCode}</ButtonLink>
        </div>
      )}
      {shown.kind === "ready" && shown.codes.length > 0 && (
        <>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {shown.codes.map((c) => (
              <li key={c.id}>
                <Link
                  href={localizePath(locale, `/app/codes/${c.id}`)}
                  className="grid gap-1 px-4 py-3 hover:bg-foreground/5 focus-visible:-outline-offset-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{c.name || t.untitled}</span>
                    <span className="truncate font-mono text-sm text-muted">{c.short_url.replace(/^https?:\/\//, "")}</span>
                    <span className="truncate text-sm text-muted">→ {hostOf(c.target_url)}</span>
                  </span>
                  <StatusBadge status={c.status} t={t} />
                </Link>
              </li>
            ))}
          </ul>
          {shown.next && (
            <button
              type="button"
              onClick={loadMore}
              disabled={shown.loadingMore}
              className="inline-flex min-h-11 w-fit items-center rounded-md border border-control px-4 text-sm font-medium hover:bg-foreground/5 disabled:opacity-60"
            >
              {t.loadMore}
            </button>
          )}
          {moreFailed && <FormAlert message={t.loadFailed} />}
        </>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
