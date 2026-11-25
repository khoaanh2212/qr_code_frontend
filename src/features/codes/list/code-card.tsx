"use client";

import { CornerDownRight, Download, Folder, FolderInput, Pause, Play, ScanLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import type { DynamicCode, ListedCode } from "@/lib/api/types";
import { formatDate } from "@/lib/format/time";
import type { QrFormat } from "@/lib/qr/types";
import { StatusBadge } from "../status-badge";
import { CodeThumbnail } from "./code-thumbnail";
import type { CodesView } from "./use-codes-view";

export interface CodeCardActions {
  onDownload: (code: DynamicCode, format: QrFormat) => void;
  onToggleStatus: (code: DynamicCode) => void;
  onDelete: (code: DynamicCode) => void;
  /** Absent when the person may not move codes (a viewer) or there is no folder to move to. */
  onMove?: (code: DynamicCode) => void;
}

export interface CodeCardProps extends CodeCardActions {
  code: ListedCode;
  layout: CodesView;
  workspaceId: string;
  locale: Locale;
  t: Messages["codes"];
  selected: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
  /** Another action is running: changes wait for it (downloads stay available). */
  busy?: boolean;
  /** The name of the folder the code is in, when it has one. */
  folderName?: string;
}

/** "https://example.com/menu/" → "example.com/menu", as people read a link. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/**
 * One dynamic code: thumbnail, name (the link to its page), status, creation date, short link with
 * a copy button, destination, and its actions menu. An `article` named by the code, so screen
 * reader users can jump between codes. Everything shown is user content and rendered as text.
 * Memoized: with stable callbacks from the list, toggling one card re-renders only that card.
 */
export const CodeCard = memo(function CodeCard({
  code,
  layout,
  workspaceId,
  locale,
  t,
  selected,
  onSelectedChange,
  busy = false,
  folderName,
  onDownload,
  onToggleStatus,
  onDelete,
  onMove,
}: CodeCardProps) {
  const l = t.list;
  const name = code.name || t.untitled;
  const href = localizePath(locale, `/app/codes/${encodeURIComponent(code.id)}`);
  const grid = layout === "grid";

  const select = (
    <Checkbox label={format(l.selectCode, { name })} hideLabel checked={selected} onChange={(e) => onSelectedChange(code.id, e.target.checked)} />
  );
  const menu = (
    <Menu label={format(l.actions, { name })}>
      <MenuItem icon={Download} onSelect={() => onDownload(code, "png")}>
        {l.downloadPng}
      </MenuItem>
      <MenuItem icon={Download} onSelect={() => onDownload(code, "svg")}>
        {l.downloadSvg}
      </MenuItem>
      <MenuSeparator />
      {onMove && (
        <MenuItem icon={FolderInput} disabled={busy || code.status === "locked"} onSelect={() => onMove(code)}>
          {t.folders.move}
        </MenuItem>
      )}
      <MenuItem icon={code.status === "paused" ? Play : Pause} disabled={busy || code.status === "locked"} onSelect={() => onToggleStatus(code)}>
        {code.status === "paused" ? l.resume : l.pause}
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon={Trash2} tone="danger" disabled={busy} onSelect={() => onDelete(code)}>
        {l.delete}
      </MenuItem>
    </Menu>
  );
  const thumb = (
    // The name link is the card's link; the thumbnail repeats it for the mouse only.
    <Link href={href} tabIndex={-1} aria-hidden="true" className={grid ? "block w-full max-w-44 self-center" : "block"}>
      <CodeThumbnail workspaceId={workspaceId} code={code} className={grid ? "w-full" : "size-16 sm:size-20"} />
    </Link>
  );
  const date = formatDate(code.created_at, locale);
  const body = (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="min-w-0">
        <Link href={href} className="-my-2.5 block truncate py-2.5 font-semibold underline-offset-4 hover:underline" title={name}>
          {name}
        </Link>
      </h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <StatusBadge status={code.status} t={t} />
        {date && <span>{format(l.createdOn, { date })}</span>}
        <span className="inline-flex items-center gap-1 tabular-nums">
          <ScanLine aria-hidden="true" className="size-4" />
          {plural(locale, l.scans, code.scans_total)}
        </span>
        {folderName && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1">
            <Folder aria-hidden="true" className="size-4 shrink-0" />
            <span className="sr-only">{t.folders.inFolder}: </span>
            <span className="truncate" title={folderName}>
              {folderName}
            </span>
          </span>
        )}
      </div>
      <div className="-my-1 flex min-w-0 items-center gap-1">
        <span className="truncate font-mono text-sm">{displayUrl(code.short_url)}</span>
        <CopyButton value={code.short_url} label={l.copyLink} copiedLabel={l.copied} failedLabel={l.copyFailed} />
      </div>
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted" title={code.target_url}>
        <CornerDownRight aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">{l.destination}: </span>
        <span className="truncate">{displayUrl(code.target_url)}</span>
      </p>
    </div>
  );

  const frame = `rounded-lg border bg-surface transition-colors duration-150 ${selected ? "border-accent bg-accent-soft" : "border-border"}`;
  if (grid) {
    return (
      <article aria-label={name} className={`flex h-full flex-col gap-3 p-3 ${frame}`}>
        <div className="-m-1 flex items-center justify-between">
          {select}
          {menu}
        </div>
        {thumb}
        {body}
      </article>
    );
  }
  return (
    <article aria-label={name} className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 py-3 pr-2 pl-1 sm:gap-4 ${frame}`}>
      {select}
      {thumb}
      {body}
      <div className="self-start">{menu}</div>
    </article>
  );
});
