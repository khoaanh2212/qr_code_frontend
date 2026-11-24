"use client";

import { useCallback, useRef, useState } from "react";
import { redirectToLogin } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { saveBlob } from "@/lib/browser/download";
import type { QrFormat } from "@/lib/qr/types";
import { codeImage, deleteCode, updateCode } from "../api";
import { settleEach } from "./settle";

/** The outcome of the last action, announced politely. */
export interface ActionNotice {
  done?: string;
  failed?: string;
}

export interface PendingDelete {
  /** What the dialog deletes when confirmed (after a partial failure: what is left). */
  codes: readonly DynamicCode[];
  title: string;
  error?: string;
}

export interface CodeActions {
  /** An action runs; others wait (they are ignored, and the UI disables them). */
  busy: boolean;
  notice: ActionNotice;
  pendingDelete: PendingDelete | null;
  /** Counts finished deletions, so the list can move focus off the removed cards. */
  deletions: number;
  download: (code: DynamicCode, format: QrFormat) => void;
  /** `bulk`: started from the selection, which then keeps only the codes that failed. */
  setStatus: (codes: readonly DynamicCode[], status: "active" | "paused", bulk: boolean) => void;
  askDelete: (codes: readonly DynamicCode[]) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
}

interface Options {
  workspaceId: string | undefined;
  locale: string;
  t: Messages["codes"];
  update: (code: DynamicCode) => void;
  remove: (ids: ReadonlySet<string>) => void;
  /** Replaces the selection (with the codes an action failed on). */
  select: (ids: Iterable<string>) => void;
}

const onAuthError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) redirectToLogin();
};

/** Deleting is idempotent: a code already gone (another tab, a lost response) counts as deleted. */
async function deleteIfPresent(workspaceId: string, id: string): Promise<void> {
  try {
    await deleteCode(workspaceId, id);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }
}

/**
 * Per-code and bulk actions of the codes list: download, pause / resume, delete with
 * confirmation. One action at a time; bulk work runs with bounded concurrency and reports partial
 * failures instead of all-or-nothing. Callbacks are stable, so memoized cards do not re-render.
 */
export function useCodeActions({ workspaceId: ws, locale, t, update, remove, select }: Options): CodeActions {
  const l = t.list;
  const [busy, setBusy] = useState(false);
  const running = useRef(false); // read synchronously: two clicks in one frame must not both start
  const [notice, setNotice] = useState<ActionNotice>({});
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deletions, setDeletions] = useState(0);

  const deleteTitle = useCallback(
    (codes: readonly DynamicCode[]) =>
      codes.length === 1 ? format(l.deleteOneTitle, { name: codes[0]!.name || t.untitled }) : plural(locale, l.deleteManyTitle, codes.length),
    [l, t.untitled, locale],
  );

  const start = useCallback(() => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    return true;
  }, []);
  const finish = useCallback(() => {
    running.current = false;
    setBusy(false);
  }, []);

  const setStatus = useCallback(
    async (codes: readonly DynamicCode[], status: "active" | "paused", bulk: boolean) => {
      if (!ws || codes.length === 0 || !start()) return;
      setNotice({});
      const { ok, failed } = await settleEach(
        codes.map((c) => c.id),
        async (id) => update(await updateCode(ws, id, { status })),
        { onError: onAuthError },
      );
      finish();
      const many = status === "paused" ? l.pausedMany : l.resumedMany;
      const one = status === "paused" ? l.pausedOne : l.resumedOne;
      setNotice({
        done: ok.length === 0 ? undefined : bulk ? plural(locale, many, ok.length) : one,
        failed: failed.length === 0 ? undefined : plural(locale, l.failed, failed.length),
      });
      if (bulk) select(failed);
    },
    [ws, locale, l, update, select, start, finish],
  );

  const download = useCallback(
    async (code: DynamicCode, fmt: QrFormat) => {
      if (!ws) return;
      setNotice({});
      try {
        // The short code comes from the API; keep the file name to safe characters anyway.
        saveBlob(await codeImage(ws, code.id, fmt), `proofqr-${code.short_code.replace(/[^\w-]/g, "")}.${fmt}`);
      } catch (err) {
        onAuthError(err);
        setNotice({ failed: l.downloadFailed });
      }
    },
    [ws, l],
  );

  const askDelete = useCallback(
    (codes: readonly DynamicCode[]) => {
      if (codes.length === 0 || running.current) return;
      setPendingDelete({ codes, title: deleteTitle(codes) });
    },
    [deleteTitle],
  );

  const confirmDelete = useCallback(async () => {
    if (!ws || !pendingDelete || !start()) return;
    const { codes } = pendingDelete;
    const { ok, failed } = await settleEach(
      codes.map((c) => c.id),
      (id) => deleteIfPresent(ws, id),
      { onError: onAuthError },
    );
    finish();
    remove(new Set(ok));
    if (failed.length === 0) {
      setPendingDelete(null);
      select([]);
      setNotice({ done: codes.length === 1 ? l.deletedOne : plural(locale, l.deletedMany, ok.length) });
      setDeletions((n) => n + 1);
      return;
    }
    // Keep the dialog on what is left, titled for it, so the person can retry or cancel.
    const left = codes.filter((c) => failed.includes(c.id));
    select(failed);
    setPendingDelete({
      codes: left,
      title: deleteTitle(left),
      error: codes.length === 1 ? t.errors.generic : plural(locale, l.failed, failed.length),
    });
  }, [ws, pendingDelete, remove, select, l, locale, t.errors.generic, deleteTitle, start, finish]);

  const cancelDelete = useCallback(() => {
    if (!running.current) setPendingDelete(null);
  }, []);

  return {
    busy,
    notice,
    pendingDelete,
    deletions,
    // Async callbacks report their outcome through `notice`; nothing awaits them.
    download,
    setStatus,
    askDelete,
    confirmDelete,
    cancelDelete,
  };
}
