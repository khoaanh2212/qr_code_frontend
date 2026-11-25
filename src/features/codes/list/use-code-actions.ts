"use client";

import { useCallback, useRef, useState } from "react";
import { redirectToLogin } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import { ApiError } from "@/lib/api";
import { DEFAULT_RETRY_AFTER_SECONDS } from "@/lib/api/common-errors";
import type { BulkAction, DynamicCode } from "@/lib/api/types";
import { saveBlob } from "@/lib/browser/download";
import type { QrFormat } from "@/lib/qr/types";
import { BULK_MAX_CODES, bulkCodes, bulkMove, codeImage, deleteCode, updateCode } from "../api";
import { isFolderGone } from "../folders/errors";

/** The outcome of the last action, announced politely: what was done, and what was not and why. */
export interface ActionNotice {
  done?: string;
  problems?: readonly string[];
}

export interface PendingDelete {
  /** What the dialog deletes when confirmed (after a partial failure: what is left). */
  codes: readonly DynamicCode[];
  title: string;
  /** Started from the selection: deleted with bulk requests. */
  bulk: boolean;
  error?: string;
}

export interface CodeActions {
  /** An action runs; others wait (they are ignored, and the UI disables them). */
  busy: boolean;
  notice: ActionNotice;
  pendingDelete: PendingDelete | null;
  /** Counts finished deletions, so the list can move focus off the removed cards. */
  deletions: number;
  /** Says something in the list's status area (or clears it). */
  announce: (message?: string) => void;
  download: (code: DynamicCode, format: QrFormat) => void;
  /** `bulk`: started from the selection, which then keeps only the codes that were not changed. */
  setStatus: (codes: readonly DynamicCode[], status: "active" | "paused", bulk: boolean) => void;
  /** `bulk`: started from the selection (bulk requests, selection kept for what is left). */
  askDelete: (codes: readonly DynamicCode[], bulk: boolean) => void;
  /** Moves codes into a folder (`id` null: out of any folder). `bulk`: as `setStatus`. */
  move: (codes: readonly DynamicCode[], target: FolderTarget, bulk: boolean) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
}

/** Where a move puts codes: a folder id (with its name, for the message) or no folder. */
export interface FolderTarget {
  id: string | null;
  name: string;
}

interface Options {
  workspaceId: string | undefined;
  locale: string;
  t: Messages["codes"];
  update: (code: DynamicCode) => void;
  remove: (ids: ReadonlySet<string>) => void;
  /** Replaces the selection (with the codes an action did not change). */
  select: (ids: Iterable<string>) => void;
  /** Codes were moved or deleted, so folder counts may have changed. */
  onCodesChanged?: () => void;
}

const onAuthError = (err: unknown) => {
  if (err instanceof ApiError && err.status === 401) redirectToLogin();
};

/** What a run of bulk requests did. */
interface BulkRun {
  /** Changed (or, for a delete, gone: a code already deleted counts as deleted). */
  done: string[];
  /** Pause/resume of codes deleted meanwhile: they leave the list. */
  gone: string[];
  /** Codes as the API returned them after a pause or resume. */
  changed: DynamicCode[];
  /** Refused because the email is not verified (resuming). */
  unverified: string[];
  /** Moving only: locked codes. (Pausing and resuming count them as failed.) */
  locked: string[];
  /** Moving only: the target folder was deleted. */
  folderGone: string[];
  /** Unknown or failed codes. */
  failed: string[];
  /** Not sent: the bulk limit was reached (seconds to wait), or a request failed. */
  skipped: string[];
  retryAfter?: number;
}

/**
 * Sends `ids` in bulk requests of at most BULK_MAX_CODES, one after another (the API limits bulk
 * requests per account). Stops at the first request that fails as a whole; the ids not sent are
 * `skipped`, with the wait when it was the rate limit.
 */
type BulkOp = { action: Exclude<BulkAction, "move"> } | { action: "move"; folderId: string | null };

async function runBulk(workspaceId: string, op: BulkOp, ids: readonly string[]): Promise<BulkRun> {
  const { action } = op;
  const run: BulkRun = { done: [], gone: [], changed: [], unverified: [], locked: [], folderGone: [], failed: [], skipped: [] };
  for (let i = 0; i < ids.length; i += BULK_MAX_CODES) {
    const chunk = ids.slice(i, i + BULK_MAX_CODES);
    try {
      const sent = op.action === "move" ? await bulkMove(workspaceId, chunk, op.folderId) : await bulkCodes(workspaceId, op.action, chunk);
      const answered = new Map(sent.map((r) => [r.id, r]));
      // Classify what was sent, not what came back: an id without an answer was not changed,
      // and an answer for an id not sent is ignored.
      for (const id of chunk) {
        const r = answered.get(id);
        if (r?.result === "ok" || (r?.result === "not_found" && action === "delete")) {
          run.done.push(id);
          if (r.code?.id === id) run.changed.push(r.code);
        } else if (r?.result === "not_found") {
          run.gone.push(id);
        } else if (r?.result === "email_not_verified") {
          run.unverified.push(id);
        } else if (action === "move" && r?.result === "locked") {
          run.locked.push(id);
        } else if (action === "move" && r?.result === "folder_not_found") {
          run.folderGone.push(id);
        } else {
          run.failed.push(id);
        }
      }
    } catch (err) {
      onAuthError(err);
      if (action === "move" && isFolderGone(err)) {
        // The folder was deleted before this request: it and the rest were not moved.
        run.folderGone.push(...ids.slice(i));
        break;
      }
      run.skipped = ids.slice(i);
      if (err instanceof ApiError && err.status === 429) {
        // Trust the wait within reason: 1 second to 1 hour.
        run.retryAfter = Math.min(3600, Math.max(1, err.retryAfter ?? DEFAULT_RETRY_AFTER_SECONDS));
      }
      break;
    }
  }
  return run;
}

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
 * confirmation. A card's menu changes one code with its own request; the selection uses the bulk
 * endpoint (backend PLAN item 51) and reports partial results per reason instead of
 * all-or-nothing. One action at a time; callbacks are stable, so memoized cards do not re-render.
 */
export function useCodeActions({ workspaceId: ws, locale, t, update, remove, select, onCodesChanged }: Options): CodeActions {
  const l = t.list;
  const f = t.folders;
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

  /** Why the codes of a bulk run that were not changed stayed as they were. */
  const problemsOf = useCallback(
    (run: BulkRun): string[] => {
      const out: string[] = [];
      if (run.unverified.length > 0) out.push(t.errors.verifyFirst);
      if (run.locked.length > 0) out.push(plural(locale, f.moveLocked, run.locked.length));
      if (run.folderGone.length > 0) out.push(plural(locale, f.moveFolderGone, run.folderGone.length));
      // Codes not sent because of the rate limit get their own message; any other way a code was
      // not changed counts once, in one message.
      const limited = run.retryAfter !== undefined;
      const failed = run.failed.length + (limited ? 0 : run.skipped.length);
      if (failed > 0) out.push(plural(locale, l.failed, failed));
      if (limited) out.push(format(l.bulkRateLimited, { seconds: run.retryAfter! }));
      return out;
    },
    [t.errors.verifyFirst, l, f, locale],
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
      if (!bulk) {
        const [code] = codes;
        try {
          update(await updateCode(ws, code!.id, { status }));
          setNotice({ done: status === "paused" ? l.pausedOne : l.resumedOne });
        } catch (err) {
          onAuthError(err);
          const verify = err instanceof ApiError && err.code === "email_not_verified";
          setNotice({ problems: [verify ? t.errors.verifyFirst : plural(locale, l.failed, 1)] });
        }
        finish();
        return;
      }
      const run = await runBulk(
        ws,
        { action: status === "paused" ? "pause" : "resume" },
        codes.map((c) => c.id),
      );
      finish();
      run.changed.forEach(update);
      if (run.gone.length > 0) remove(new Set(run.gone));
      const many = status === "paused" ? l.pausedMany : l.resumedMany;
      setNotice({ done: run.done.length > 0 ? plural(locale, many, run.done.length) : undefined, problems: problemsOf(run) });
      select([...run.unverified, ...run.failed, ...run.skipped]);
    },
    [ws, locale, l, t.errors.verifyFirst, update, remove, select, start, finish, problemsOf],
  );

  const move = useCallback(
    async (codes: readonly DynamicCode[], target: FolderTarget, bulk: boolean) => {
      if (!ws || codes.length === 0 || !start()) return;
      setNotice({});
      if (!bulk) {
        const [code] = codes;
        if (code!.folder_id === target.id) return finish(); // already there: nothing to write
        try {
          update(await updateCode(ws, code!.id, { folder_id: target.id }));
          setNotice({ done: target.id === null ? f.movedOut : format(f.movedOne, { folder: target.name }) });
        } catch (err) {
          onAuthError(err);
          if (err instanceof ApiError && err.status === 404) {
            // Deleted elsewhere: it leaves the list, as a bulk "not found" does.
            remove(new Set([code!.id]));
            setNotice({});
            finish();
            onCodesChanged?.();
            return;
          }
          const problem =
            err instanceof ApiError && err.code === "code_locked"
              ? t.errors.locked
              : isFolderGone(err)
                ? plural(locale, f.moveFolderGone, 1)
                : plural(locale, l.failed, 1);
          setNotice({ problems: [problem] });
        }
        finish();
        onCodesChanged?.();
        return;
      }
      const run = await runBulk(
        ws,
        { action: "move", folderId: target.id },
        codes.map((c) => c.id),
      );
      finish();
      run.changed.forEach(update);
      if (run.gone.length > 0) remove(new Set(run.gone));
      const moved = run.done.length;
      const done = target.id === null ? plural(locale, f.movedOutMany, moved) : plural(locale, f.movedMany, moved, { folder: target.name });
      setNotice({ done: moved > 0 ? done : undefined, problems: problemsOf(run) });
      select([...run.failed, ...run.locked, ...run.folderGone, ...run.skipped]);
      onCodesChanged?.();
    },
    [ws, locale, l, f, t.errors.locked, update, remove, select, start, finish, problemsOf, onCodesChanged],
  );

  const announce = useCallback((message?: string) => setNotice(message ? { done: message } : {}), []);

  const download = useCallback(
    async (code: DynamicCode, fmt: QrFormat) => {
      if (!ws) return;
      setNotice({});
      try {
        // The short code comes from the API; keep the file name to safe characters anyway.
        saveBlob(await codeImage(ws, code.id, fmt), `proofqr-${code.short_code.replace(/[^\w-]/g, "")}.${fmt}`);
      } catch (err) {
        onAuthError(err);
        setNotice({ problems: [l.downloadFailed] });
      }
    },
    [ws, l],
  );

  const askDelete = useCallback(
    (codes: readonly DynamicCode[], bulk: boolean) => {
      if (codes.length === 0 || running.current) return;
      setPendingDelete({ codes, bulk, title: deleteTitle(codes) });
    },
    [deleteTitle],
  );

  const confirmDelete = useCallback(async () => {
    if (!ws || !pendingDelete || !start()) return;
    const { codes, bulk } = pendingDelete;
    let gone: string[];
    let error: string | undefined;
    if (bulk) {
      const run = await runBulk(
        ws,
        { action: "delete" },
        codes.map((c) => c.id),
      );
      gone = run.done;
      error = problemsOf(run).join(" ") || undefined;
    } else {
      try {
        await deleteIfPresent(ws, codes[0]!.id);
        gone = [codes[0]!.id];
      } catch (err) {
        onAuthError(err);
        gone = [];
        error = t.errors.generic;
      }
    }
    finish();
    remove(new Set(gone));
    if (gone.length > 0) onCodesChanged?.();
    const left = codes.filter((c) => !gone.includes(c.id));
    if (left.length === 0) {
      setPendingDelete(null);
      if (bulk) select([]);
      setNotice({ done: codes.length === 1 ? l.deletedOne : plural(locale, l.deletedMany, gone.length) });
      setDeletions((n) => n + 1);
      return;
    }
    // Keep the dialog on what is left, titled for it, so the person can retry or cancel.
    if (bulk) select(left.map((c) => c.id));
    setPendingDelete({ codes: left, bulk, title: deleteTitle(left), error: error ?? t.errors.generic });
  }, [ws, pendingDelete, remove, select, l, locale, t.errors.generic, deleteTitle, start, finish, problemsOf, onCodesChanged]);

  const cancelDelete = useCallback(() => {
    if (!running.current) setPendingDelete(null);
  }, []);

  return {
    busy,
    notice,
    pendingDelete,
    deletions,
    announce,
    move,
    // Async callbacks report their outcome through `notice`; nothing awaits them.
    download,
    setStatus,
    askDelete,
    confirmDelete,
    cancelDelete,
  };
}
