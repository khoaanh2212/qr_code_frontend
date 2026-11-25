"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError } from "@/lib/api";
import type { Folder } from "@/lib/api/types";
import { createFolder, deleteFolder, listFolders, renameFolder } from "./api";

export type FoldersState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; folders: readonly Folder[] };

export interface UseFoldersResult {
  state: FoldersState;
  /** The folders once loaded, else none. */
  folders: readonly Folder[];
  /** Loads again. `silent` keeps what is shown (counts after a move); otherwise a failure is shown. */
  reload: (silent?: boolean) => void;
  /** Rejects with the API's error, so the form can show it. */
  create: (name: string) => Promise<Folder>;
  rename: (id: string, name: string) => Promise<Folder>;
  /** A folder already gone (404) counts as deleted. `onGone` runs just before it leaves the list. */
  remove: (id: string, onGone?: () => void) => Promise<void>;
}

const NONE: readonly Folder[] = [];
const collator = new Intl.Collator(undefined, { sensitivity: "base" });
const byName = (a: Folder, b: Folder) => collator.compare(a.name, b.name);

const onAuthError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) redirectToLogin();
};

/**
 * The workspace's folders (backend PLAN item 54): loaded once, kept in step with the changes made
 * here, and loaded again (silently) when counts may have changed. A change made here cancels a
 * load that is still on its way (its answer predates the change) and loads again.
 */
export function useFolders(workspaceId: string | undefined): UseFoldersResult {
  const [state, setState] = useState<FoldersState>({ kind: "loading" });
  const latest = useRef(0); // only the newest load may answer
  const inflight = useRef(false);

  const load = useCallback(
    (signal: AbortSignal, silent: boolean) => {
      if (!workspaceId) return;
      const mine = ++latest.current;
      inflight.current = true;
      listFolders(workspaceId, signal)
        .then((folders) => {
          if (signal.aborted || mine !== latest.current) return;
          inflight.current = false;
          setState({ kind: "ready", folders });
        })
        .catch((err: unknown) => {
          if (signal.aborted || mine !== latest.current) return;
          inflight.current = false;
          onAuthError(err);
          // A failed silent refresh keeps the folders on screen.
          setState((prev) => (silent && prev.kind === "ready" ? prev : { kind: "error" }));
        });
    },
    [workspaceId],
  );

  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    abort.current = controller;
    load(controller.signal, false);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(
    (silent = false) => {
      if (!silent) setState((prev) => (prev.kind === "error" ? { kind: "loading" } : prev));
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      load(controller.signal, silent);
    },
    [load],
  );

  /** Applies a change made here; a load on its way would overwrite it, so it is replaced. */
  const change = useCallback(
    (fn: (folders: readonly Folder[]) => readonly Folder[]) => {
      const pending = inflight.current;
      if (pending) {
        latest.current++;
        abort.current?.abort();
        inflight.current = false;
      }
      setState((prev) => (prev.kind === "ready" ? { kind: "ready", folders: fn(prev.folders) } : prev));
      if (pending) reload(true);
    },
    [reload],
  );

  const need = useCallback(() => {
    if (!workspaceId) throw new Error("no workspace");
    return workspaceId;
  }, [workspaceId]);

  const create = useCallback(
    async (name: string) => {
      try {
        const folder = await createFolder(need(), name);
        change((fs) => [...fs.filter((f) => f.id !== folder.id), folder].sort(byName));
        return folder;
      } catch (err) {
        onAuthError(err);
        throw err;
      }
    },
    [need, change],
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      try {
        const folder = await renameFolder(need(), id, name);
        change((fs) => fs.map((f) => (f.id === id ? folder : f)).sort(byName));
        return folder;
      } catch (err) {
        onAuthError(err);
        throw err;
      }
    },
    [need, change],
  );

  const remove = useCallback(
    async (id: string, onGone?: () => void) => {
      try {
        await deleteFolder(need(), id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          onAuthError(err);
          throw err;
        }
      }
      onGone?.();
      change((fs) => fs.filter((f) => f.id !== id));
    },
    [need, change],
  );

  return { state, folders: state.kind === "ready" ? state.folders : NONE, reload, create, rename, remove };
}
