"use client";

import { ChartColumn, CornerDownRight, Download, Folder, FolderInput, Palette, Pause, Pencil, Play, Trash2, type LucideIcon } from "lucide-react";
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
import { CODE_ANCHORS, type CodeAnchor } from "../anchors";
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
  /** False for viewers: no shortcuts into the forms that change the code. */
  canEdit?: boolean;
}

/** "https://example.com/menu/" → "example.com/menu", as people read a link. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/**
 * A 44px link that shows only an icon; `label` is its name and tooltip. `pointerOnly` is for a
 * shortcut the card already offers in words (the scan count, "Change"): like the thumbnail, it is
 * there for the mouse and adds no second stop for the keyboard or a screen reader.
 */
function IconLink({
  href,
  label,
  icon: Icon,
  pointerOnly = false,
  className = "",
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pointerOnly?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      tabIndex={pointerOnly ? -1 : undefined}
      aria-hidden={pointerOnly || undefined}
      className={`size-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-foreground/5 hover:text-foreground ${className || "inline-flex"}`}
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </Link>
  );
}

/**
 * One dynamic code. In the list: thumbnail (with a download button on its corner), name (the link
 * to its page), status and creation date, short link with a copy button, destination with a way
 * to change it, then on the right the shortcuts (statistics, destination, design, the actions
 * menu) above the scan count, which is the card's figure and leads to the statistics. On phones
 * the same parts stack: name, the code large in the middle, links, then scans and actions in one
 * row (statistics and destination stay reachable through the count and "Change"). An `article`
 * named by the code, so screen reader users can jump between codes. Everything shown is user
 * content and rendered as text. Memoized: with stable callbacks from the list, toggling one card
 * re-renders only that card.
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
  canEdit = true,
  onDownload,
  onToggleStatus,
  onDelete,
  onMove,
}: CodeCardProps) {
  const l = t.list;
  const name = code.name || t.untitled;
  const href = localizePath(locale, `/app/codes/${encodeURIComponent(code.id)}`);
  const grid = layout === "grid";
  const editable = canEdit && code.status !== "locked";
  const to = (anchor: CodeAnchor) => `${href}#${anchor}`;
  const insights = `${href}/insights`;

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
  const download = (
    // A small disc on the code's corner; its hit area reaches 44px around it.
    <button
      type="button"
      aria-label={format(l.downloadOf, { name })}
      title={format(l.downloadOf, { name })}
      onClick={() => onDownload(code, "png")}
      className="absolute -top-2 -right-2 inline-flex size-7 items-center justify-center rounded-full border border-control bg-surface text-muted transition-colors duration-150 before:absolute before:-inset-2 hover:text-foreground"
    >
      <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
    </button>
  );
  const thumb = (className: string) => (
    <div className="relative">
      {/* The name link is the card's link; the thumbnail repeats it for the mouse only. */}
      <Link href={href} tabIndex={-1} aria-hidden="true" className="block">
        <CodeThumbnail workspaceId={workspaceId} code={code} className={className} />
      </Link>
      {download}
    </div>
  );
  const date = formatDate(code.created_at, locale);
  const head = (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="min-w-0">
        <Link href={href} className="-my-2.5 block truncate py-2.5 font-semibold underline-offset-4 hover:underline" title={name}>
          {name}
        </Link>
      </h3>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <StatusBadge status={code.status} t={t} />
        {date && <span>{format(l.createdOn, { date })}</span>}
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
    </div>
  );
  const links = (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="-my-1 flex min-w-0 items-center gap-1">
        <span className="truncate font-mono text-sm">{displayUrl(code.short_url)}</span>
        <CopyButton value={code.short_url} label={l.copyLink} copiedLabel={l.copied} failedLabel={l.copyFailed} />
      </div>
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <CornerDownRight aria-hidden="true" className="size-4 shrink-0" />
        <span className="sr-only">{l.destination}: </span>
        <span className="truncate" title={code.target_url}>
          {displayUrl(code.target_url)}
        </span>
        {editable && (
          <Link
            href={to(CODE_ANCHORS.destination)}
            aria-label={format(l.changeDestinationOf, { name })}
            className="-my-3 inline-flex shrink-0 items-center py-3 font-medium text-foreground underline underline-offset-4 hover:no-underline"
          >
            {l.changeDestination}
          </Link>
        )}
      </p>
    </div>
  );
  // "1,234 scans" with the figure set apart: the words around it come from the catalog.
  const scansText = plural(locale, l.scans, code.scans_total);
  const figure = new Intl.NumberFormat(locale).format(code.scans_total);
  const at = scansText.indexOf(figure);
  const scans = (
    <Link
      href={insights}
      aria-label={format(l.scansLink, { scans: scansText })}
      className="inline-flex min-h-11 shrink-0 items-baseline rounded-md px-2 text-sm whitespace-pre text-muted transition-colors duration-150 hover:bg-foreground/5"
    >
      {at < 0 ? (
        scansText
      ) : (
        <>
          {scansText.slice(0, at)}
          <span className="text-2xl leading-none font-semibold text-foreground tabular-nums">{figure}</span>
          {scansText.slice(at + figure.length)}
        </>
      )}
    </Link>
  );
  // Statistics and destination have another way in on every card (the count, "Change"): their
  // icons are a convenience for the mouse from `sm` up, and phones drop them.
  const shortcuts = (
    <div className="flex items-center">
      <IconLink
        href={insights}
        label={format(l.statsOf, { name })}
        icon={ChartColumn}
        pointerOnly
        className={grid ? "hidden" : "hidden sm:inline-flex"}
      />
      {editable && (
        <IconLink
          href={to(CODE_ANCHORS.destination)}
          label={format(l.editDestinationOf, { name })}
          icon={Pencil}
          pointerOnly
          className={grid ? "hidden" : "hidden sm:inline-flex"}
        />
      )}
      {editable && <IconLink href={to(CODE_ANCHORS.design)} label={format(l.editDesignOf, { name })} icon={Palette} />}
      {menu}
    </div>
  );

  const frame = `rounded-lg border bg-surface transition-colors duration-150 ${selected ? "border-accent bg-accent-soft" : "border-border"}`;
  if (grid) {
    return (
      <article aria-label={name} className={`flex h-full flex-col gap-3 p-3 ${frame}`}>
        <div className="-m-1 flex items-center justify-between">
          {select}
          {shortcuts}
        </div>
        <div className="flex justify-center pt-2">{thumb("w-36")}</div>
        {head}
        {links}
        <div className="-mx-2 mt-auto -mb-1">{scans}</div>
      </article>
    );
  }
  return (
    <article
      aria-label={name}
      className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:gap-y-1 sm:py-3 sm:pr-2 sm:pl-1 ${frame}`}
    >
      <div className="sm:col-start-1 sm:row-span-2 sm:row-start-1">{select}</div>
      <div className="min-w-0 sm:col-start-3 sm:row-start-1 sm:self-end">{head}</div>
      <div className="col-span-2 flex justify-center rounded-md bg-foreground/5 p-5 sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:bg-transparent sm:p-0">
        {thumb("w-36 sm:w-20")}
      </div>
      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:self-start">{links}</div>
      <div className="col-span-2 -mx-2 -mb-1 flex items-center justify-between gap-2 sm:col-span-1 sm:col-start-4 sm:row-span-2 sm:row-start-1 sm:m-0 sm:h-full sm:flex-col-reverse sm:items-end sm:justify-between">
        {scans}
        {shortcuts}
      </div>
    </article>
  );
});
