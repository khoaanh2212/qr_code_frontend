"use client";

import { useCallback, useEffect, useState } from "react";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { listCodes } from "../api";

export type CodesState =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      codes: readonly DynamicCode[];
      /** Cursor of the next page; null on the last one. */
      next: string | null;
      /** The next page is being fetched. */
      loadingMore: boolean;
      /** The last "next page" request failed; `loadMore` retries it. */
      moreFailed: boolean;
    };

export interface UseCodesResult {
  state: CodesState;
  /** Loads the first page again after an error. */
  retry: () => void;
  /** Asks for the next page, or retries it after a failure. */
  loadMore: () => void;
  /** Replaces a code after a change made through the API. */
  update: (code: DynamicCode) => void;
  /** Drops deleted codes. */
  remove: (ids: ReadonlySet<string>) => void;
}

type Data =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; codes: readonly DynamicCode[]; next: string | null; moreRequested: boolean; moreFailed: boolean };

const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;

/**
 * The workspace's codes, page by page, newest first. With `loadAll` it keeps fetching until the
 * last page: search, filters and other orders are applied in the browser and are only right over
 * the whole list (a workspace holds at most a few hundred codes; see query.ts). Turning `loadAll`
 * off cancels the page in flight. An expired session sends the person to the login page.
 */
export function useCodes(workspaceId: string | undefined, { loadAll }: { loadAll: boolean }): UseCodesResult {
  const [data, setData] = useState<Data>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!workspaceId) return;
    const abort = new AbortController();
    listCodes(workspaceId, undefined, abort.signal)
      .then((page) => {
        if (abort.signal.aborted) return;
        setData({ kind: "ready", codes: page.codes, next: page.next_cursor, moreRequested: false, moreFailed: false });
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (isUnauthorized(err)) return redirectToLogin();
        setData({ kind: "error" });
      });
    return () => abort.abort();
  }, [workspaceId, attempt]);

  // The page to fetch now, if any: wanted by `loadAll`, by a "Load more" request, or because every
  // listed code was deleted while more remain.
  const cursor =
    data.kind === "ready" && !data.moreFailed && (loadAll || data.moreRequested || data.codes.length === 0) ? data.next : null;

  useEffect(() => {
    if (!workspaceId || !cursor) return;
    const abort = new AbortController();
    // Apply only to the list this page continues (a retry may have replaced it).
    const settle = (change: (prev: Extract<Data, { kind: "ready" }>) => Data) =>
      setData((prev) => (prev.kind === "ready" && prev.next === cursor ? change(prev) : prev));
    listCodes(workspaceId, cursor, abort.signal)
      .then((page) =>
        settle((prev) => {
          // A code created meanwhile can shift pages; ids already listed are not repeated.
          const seen = new Set(prev.codes.map((c) => c.id));
          return {
            kind: "ready",
            codes: [...prev.codes, ...page.codes.filter((c) => !seen.has(c.id))],
            next: page.next_cursor,
            moreRequested: false,
            moreFailed: false,
          };
        }),
      )
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (isUnauthorized(err)) return redirectToLogin();
        settle((prev) => ({ ...prev, moreRequested: false, moreFailed: true }));
      });
    return () => abort.abort();
  }, [workspaceId, cursor]);

  const loadMore = useCallback(() => {
    setData((prev) => (prev.kind === "ready" && prev.next ? { ...prev, moreRequested: true, moreFailed: false } : prev));
  }, []);

  const retry = useCallback(() => {
    setData({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const update = useCallback((code: DynamicCode) => {
    setData((prev) => (prev.kind === "ready" ? { ...prev, codes: prev.codes.map((c) => (c.id === code.id ? code : c)) } : prev));
  }, []);

  const remove = useCallback((ids: ReadonlySet<string>) => {
    setData((prev) => (prev.kind === "ready" ? { ...prev, codes: prev.codes.filter((c) => !ids.has(c.id)) } : prev));
  }, []);

  const state: CodesState =
    data.kind === "ready"
      ? { kind: "ready", codes: data.codes, next: data.next, loadingMore: cursor !== null, moreFailed: data.moreFailed }
      : data;
  return { state, retry, loadMore, update, remove };
}
