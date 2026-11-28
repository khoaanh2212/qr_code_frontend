"use client";

import { Download, FolderInput, Link2, Palette, Pause, Pencil, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { SavedNote } from "@/features/account/section";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { saveBlob } from "@/lib/browser/download";
import type { QrFormat } from "@/lib/qr/types";
import { codeImage, deleteCode, updateCode } from "../api";
import { codeFailure } from "../errors";
import { isFolderGone } from "../folders/errors";
import { MoveDialog } from "../folders/move-dialog";
import { useFolders } from "../folders/use-folders";
import { displayUrl } from "../list/code-card";
import { ReadyDialog } from "../list/ready-dialog";
import { SlugDialog } from "../slug-dialog";
import { StatusBadge } from "../status-badge";
import { formatDate } from "@/lib/format/time";

type T = Messages["codes"];
type Open = null | "download" | "link" | "delete";

/**
 * What a code is, on top of its insights: status, name, creation date, folder and destination,
 * with "Edit content", "Download" and a menu of the rest (design, short link, folder, pause,
 * delete), each in a dialog or on its own page. Viewers get the download only; a locked code keeps
 * its downloads and deletion.
 */
export function CodeHeader({
  t,
  auth,
  locale,
  ws,
  code,
  canEdit,
  onSaved,
}: {
  t: T;
  auth: AuthMessages;
  locale: Locale;
  ws: string;
  code: DynamicCode;
  canEdit: boolean;
  onSaved: (code: DynamicCode) => void;
}) {
  const p = t.pages;
  const i = t.insights;
  const router = useRouter();
  const folders = useFolders(ws);
  const [open, setOpen] = useState<Open>(null);
  // Held in state: MoveDialog treats a new `pending` object as a new request and resets the pick.
  const [moving, setMoving] = useState<{ codes: DynamicCode[]; bulk: false } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  const name = code.name || t.untitled;
  const base = localizePath(locale, `/app/codes/${encodeURIComponent(code.id)}`);
  const editable = canEdit && code.status !== "locked";
  const created = formatDate(code.created_at, locale);
  const folderName = code.folder_id ? folders.folders.find((f) => f.id === code.folder_id)?.name : undefined;
  // A code in a folder shows nothing until the folders load, never a wrong "No folder".
  const folderKnown = !code.folder_id || folders.state.kind === "ready";

  async function change(changes: Parameters<typeof updateCode>[2], done: string) {
    if (busy) return;
    setBusy(true);
    setNote(undefined);
    setError(undefined);
    try {
      onSaved(await updateCode(ws, code.id, changes));
      setNote(done);
      if ("folder_id" in changes) folders.reload(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (isFolderGone(err)) folders.reload(true);
      setError(codeFailure(err, t, auth).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setDeleteError(undefined);
    try {
      await deleteCode(ws, code.id);
      router.push(localizePath(locale, "/app"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setDeleteError(codeFailure(err, t, auth).message);
      setBusy(false);
    }
  }

  async function download(c: DynamicCode, fmt: QrFormat) {
    try {
      saveBlob(await codeImage(ws, c.id, fmt), `proofqr-${c.short_code}.${fmt}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(t.errors.generic);
    }
  }

  return (
    <header className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={code.status} t={t} />
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <Link
              href={`${base}/edit`}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5"
            >
              <Pencil aria-hidden="true" className="size-4" />
              {p.editContent}
            </Link>
          )}
          <Button variant="secondary" onClick={() => setOpen("download")}>
            <Download aria-hidden="true" className="size-4" />
            {t.download}
          </Button>
          {canEdit && (
            <Menu label={format(p.moreActions, { name })}>
              {editable && (
                <MenuItem icon={Palette} onSelect={() => router.push(`${base}/design`)}>
                  {p.editDesign}
                </MenuItem>
              )}
              {editable && (
                <MenuItem icon={Link2} onSelect={() => setOpen("link")}>
                  {p.editShortLink}
                </MenuItem>
              )}
              {editable && folders.folders.length > 0 && (
                <MenuItem icon={FolderInput} disabled={busy} onSelect={() => setMoving({ codes: [code], bulk: false })}>
                  {t.folders.move}
                </MenuItem>
              )}
              {editable && (
                <MenuItem
                  icon={code.status === "paused" ? Play : Pause}
                  disabled={busy}
                  onSelect={() =>
                    void change(
                      { status: code.status === "paused" ? "active" : "paused" },
                      code.status === "paused" ? t.activeIntro : t.pausedIntro,
                    )
                  }
                >
                  {code.status === "paused" ? t.resume : t.pause}
                </MenuItem>
              )}
              {editable && <MenuSeparator />}
              <MenuItem icon={Trash2} tone="danger" disabled={busy} onSelect={() => setOpen("delete")}>
                {t.list.delete}
              </MenuItem>
            </Menu>
          )}
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-balance break-words">{name}</h1>
      <p className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {created && <span>{format(i.created, { date: created })}</span>}
        {folderKnown && (
          <span className="max-w-full truncate" title={folderName}>
            <span className="sr-only">{t.folders.inFolder}: </span>
            {folderName ?? p.noFolder}
          </span>
        )}
        <span className="max-w-full truncate" title={code.kind === "page" ? undefined : code.target_url}>
          <span className="sr-only">{t.list.destination}: </span>
          {code.kind === "page" ? t.list.hostedPage : displayUrl(code.target_url)}
        </span>
      </p>
      <FormAlert message={error} />
      <SavedNote message={note} />

      {open === "download" && (
        <ReadyDialog
          t={t}
          locale={locale}
          workspaceId={ws}
          code={code}
          title={p.downloadTitle}
          onDownload={(c, fmt) => void download(c, fmt)}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "link" && (
        <SlugDialog
          t={t}
          auth={auth}
          ws={ws}
          code={code}
          onSaved={onSaved}
          onClose={(saved) => {
            setOpen(null);
            setNote(saved ? t.linkSaved : undefined);
          }}
        />
      )}
      <MoveDialog
        t={t}
        pending={moving}
        folders={folders.folders}
        locale={locale}
        onConfirm={(_codes, target) => {
          setMoving(null);
          void change(
            { folder_id: target.id },
            target.id === null ? t.folders.movedOut : format(t.folders.movedOne, { folder: target.name }),
          );
        }}
        onCancel={() => setMoving(null)}
      />
      <ConfirmDialog
        open={open === "delete"}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        cancelLabel={t.cancel}
        busy={busy}
        error={deleteError}
        onConfirm={() => void remove()}
        onCancel={() => {
          setOpen(null);
          setDeleteError(undefined);
        }}
      >
        {t.deleteIntro}
      </ConfirmDialog>
    </header>
  );
}
