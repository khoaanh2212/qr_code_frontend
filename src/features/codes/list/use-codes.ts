"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError } from "@/lib/api";
import type { DynamicCode, ListedCode } from "@/lib/api/types";
import { listCodes, type CodeListParams } from "../api";
import { NO_FOLDER } from "./query";

export type CodesState =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      codes: readonly ListedCode[];
      /** Cursor of the next page; null on the last one. */
      next: string | null;
      /** The next page is being fetched. */
      loadingMore: boolean;
      /** The last "next page" request failed; `loadMore` retries it. */
      moreFailed: boolean;
      /** Results for new params are loading; `codes` are still the previous ones. */
      refreshing: boolean;
      /** Results for new params failed; `codes` are still the previous ones (`retry` asks again). */
      refreshFailed: boolean;
    };

export interface UseCodesResult {
  state: CodesState;
  /** Loads the first page again after an error (keeping the codes shown, if any). */
  retry: () => void;
  /** Asks for the next page, or retries it after a failure. */
  loadMore: () => void;
  /** Replaces a code after a change made through the API (its scans are kept). */
  update: (code: DynamicCode) => void;
  /** Drops deleted codes. */
  remove: (ids: ReadonlySet<string>) => void;
}

type Data =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      /** The params these codes answer (see `keyOf`), and their status and folder filters. */
      key: string;
      status: string | undefined;
      folder: string | undefined;
      /** The params whose first page failed to load, while these codes stay shown. */
      failedKey?: string;
      codes: readonly ListedCode[];
      next: string | null;
      moreRequested: boolean;
      moreFailed: boolean;
    };

const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;

/** A stable identity for a set of params (field order fixed). */
function keyOf(p: CodeListParams): string {
  return JSON.stringify([p.q ?? "", p.status ?? "", p.folder ?? "", p.sort ?? ""]);
}

export interface UseCodesOptions {
  /**
   * The first page under a folder filter came back empty. The API answers 200 with no codes for
   * a folder that was deleted elsewhere, so the caller checks that the folder still exists.
   */
  onEmptyFolder?: () => void;
}

/**
 * The workspace's codes for `params` (search, status, folder, order), page by page; the API
 * filters and orders them (backend PLAN items 50 and 54). New params fetch a first page again;
 * until it arrives the previous codes stay on screen (`refreshing`), and a page that answers
 * older params is dropped. A page of codes deleted down to nothing fetches the next one. An
 * expired session sends the person to the login page.
 */
export function useCodes(workspaceId: string | undefined, params: CodeListParams, options: UseCodesOptions = {}): UseCodesResult {
  const [data, setData] = useState<Data>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const key = keyOf(params);
  const { q, status, folder, sort } = params;
  const emptyFolder = useRef(options.onEmptyFolder);
  useEffect(() => {
    emptyFolder.current = options.onEmptyFolder;
  });

  useEffect(() => {
    if (!workspaceId) return;
    const abort = new AbortController();
    listCodes(workspaceId, { q, status, folder, sort }, undefined, abort.signal)
      .then((page) => {
        if (abort.signal.aborted) return;
        setData({ kind: "ready", key, status, folder, codes: page.codes, next: page.next_cursor, moreRequested: false, moreFailed: false });
        if (folder && folder !== NO_FOLDER && page.codes.length === 0 && !page.next_cursor) emptyFolder.current?.();
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (isUnauthorized(err)) return redirectToLogin();
        // Codes on screen stay, with the toolbar, so the query that failed can be changed.
        setData((prev) => (prev.kind === "ready" ? { ...prev, failedKey: key } : { kind: "error" }));
      });
    return () => abort.abort();
  }, [workspaceId, key, q, status, folder, sort, attempt]);

  const current = data.kind === "ready" && data.key === key;
  // The page to fetch now, if any: asked for by "Load more", or because every listed code was
  // deleted while more remain. Never while newer params are loading.
  const cursor = current && !data.moreFailed && (data.moreRequested || data.codes.length === 0) ? data.next : null;

  useEffect(() => {
    if (!workspaceId || !cursor) return;
    const abort = new AbortController();
    // Apply only to the list this page continues (new params or a retry may have replaced it).
    const settle = (change: (prev: Extract<Data, { kind: "ready" }>) => Data) =>
      setData((prev) => (prev.kind === "ready" && prev.key === key && prev.next === cursor ? change(prev) : prev));
    listCodes(workspaceId, { q, status, folder, sort }, cursor, abort.signal)
      .then((page) =>
        settle((prev) => {
          // A code created meanwhile can shift pages; ids already listed are not repeated.
          const seen = new Set(prev.codes.map((c) => c.id));
          return {
            ...prev,
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
  }, [workspaceId, cursor, key, q, status, folder, sort]);

  const loadMore = useCallback(() => {
    setData((prev) => (prev.kind === "ready" && prev.next ? { ...prev, moreRequested: true, moreFailed: false } : prev));
  }, []);

  const retry = useCallback(() => {
    setData((prev) => (prev.kind === "ready" ? { ...prev, failedKey: undefined } : { kind: "loading" }));
    setAttempt((n) => n + 1);
  }, []);

  const update = useCallback((code: DynamicCode) => {
    setData((prev) => {
      if (prev.kind !== "ready") return prev;
      // Under a status or folder filter, a code that left that status or folder leaves the list
      // (the filters of the list on screen, not of params still loading).
      const inFolder = (c: ListedCode) => !prev.folder || (prev.folder === NO_FOLDER ? c.folder_id === null : c.folder_id === prev.folder);
      const codes = prev.codes
        .map((c) => (c.id === code.id ? { ...code, scans_total: c.scans_total } : c))
        .filter((c) => (!prev.status || c.status === prev.status) && inFolder(c));
      return { ...prev, codes };
    });
  }, []);

  const remove = useCallback((ids: ReadonlySet<string>) => {
    setData((prev) => (prev.kind === "ready" ? { ...prev, codes: prev.codes.filter((c) => !ids.has(c.id)) } : prev));
  }, []);

  const state: CodesState =
    data.kind === "ready"
      ? {
          kind: "ready",
          codes: data.codes,
          next: data.next,
          loadingMore: cursor !== null,
          moreFailed: data.moreFailed,
          refreshing: !current && data.failedKey !== key,
          refreshFailed: !current && data.failedKey === key,
        }
      : data;
  return { state, retry, loadMore, update, remove };
}
