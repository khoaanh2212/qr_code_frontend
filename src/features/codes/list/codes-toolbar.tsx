"use client";

import { FolderInput, LayoutGrid, List, Pause, Play, SlidersHorizontal, Trash2, X } from "lucide-react";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { MAX_SEARCH_CHARS, type CodeQuery, type CodeSort, type StatusFilter } from "./query";
import type { CodesView } from "./use-codes-view";
import type { SelectionState } from "./use-selection";

export interface CodesToolbarProps {
  t: Messages["codes"];
  query: CodeQuery;
  onQueryChange: (query: CodeQuery) => void;
  view: CodesView;
  onViewChange: (view: CodesView) => void;
  /** The search box, for moving focus back to it. */
  searchRef?: Ref<HTMLInputElement>;
  /** Opens the filter panel (folders, and the status filter on phones); the list shows the folders as a column on wide screens. */
  onOpenFilters: () => void;
  /** How many of the panel's filters narrow the list (a folder, a status): shown on its button, since the panel hides them. */
  activeFilters: number;
}

/** The status choices of the list, shared by the toolbar and the filter panel. */
export function statusOptions(t: Messages["codes"]): { value: StatusFilter; label: string }[] {
  return [
    { value: "all", label: t.list.statusAll },
    { value: "active", label: t.status.active },
    { value: "paused", label: t.status.paused },
    { value: "locked", label: t.status.locked },
  ];
}

/**
 * Filters on the left (status; "Filters" opens the panel with the folders below the `lg`
 * breakpoint), then order, layout and search on the right. On phones the search takes a row of its
 * own, the status filter moves into the panel and the layout switch goes: phones get the list.
 * Controlled: the list owns the query.
 */
export function CodesToolbar({ t, query, onQueryChange, view, onViewChange, searchRef, onOpenFilters, activeFilters }: CodesToolbarProps) {
  const l = t.list;
  const sorts: { value: CodeSort; label: string }[] = [
    { value: "newest", label: l.sortNewest },
    { value: "oldest", label: l.sortOldest },
    { value: "name", label: l.sortName },
    { value: "scans", label: l.sortScans },
  ];
  return (
    <div role="search" className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Button
        variant="secondary"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        aria-label={activeFilters > 0 ? format(l.filtersActive, { count: activeFilters }) : undefined}
        className="lg:hidden"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        {l.filters}
        {activeFilters > 0 && (
          <span aria-hidden="true" className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-foreground tabular-nums">
            {activeFilters}
          </span>
        )}
      </Button>
      <Select
        label={l.statusFilter}
        hideLabel
        value={query.status}
        options={statusOptions(t)}
        onChange={(status) => onQueryChange({ ...query, status })}
        className="max-sm:hidden"
      />
      <Select
        label={l.sort}
        hideLabel
        value={query.sort}
        options={sorts}
        onChange={(sort) => onQueryChange({ ...query, sort })}
        className="ml-auto min-w-0"
      />
      <div className="max-sm:hidden">
        <SegmentedControl
          legend={l.view}
          value={view}
          onChange={onViewChange}
          hideLabels
          options={[
            { value: "list", label: l.viewList, icon: List },
            { value: "grid", label: l.viewGrid, icon: LayoutGrid },
          ]}
        />
      </div>
      <SearchField
        label={l.search}
        placeholder={l.searchPlaceholder}
        value={query.search}
        onValueChange={(search) => onQueryChange({ ...query, search })}
        ref={searchRef}
        maxLength={MAX_SEARCH_CHARS}
        className="min-w-0 basis-full lg:basis-80"
      />
    </div>
  );
}

export interface SelectionBarProps {
  t: Messages["codes"];
  state: SelectionState;
  count: number;
  /** What the bar says when nothing is selected (the list's count). */
  summary: string;
  onToggleAll: () => void;
  onClear: () => void;
  /** Absent when no selected code can take that action (all paused, all locked…). */
  onPause?: () => void;
  onResume?: () => void;
  /** Absent for viewers, and while there are no folders to move into. */
  onMove?: () => void;
  onDelete: () => void;
  busy: boolean;
}

/** The row above the codes: select all, the count, and what can be done to the selection. */
export function SelectionBar({ t, state, count, summary, onToggleAll, onClear, onPause, onResume, onMove, onDelete, busy }: SelectionBarProps) {
  const l = t.list;
  // Below `lg` an active selection is pinned to the bottom edge, in reach of the thumb; the
  // wrapper keeps the row's height so the list does not jump when the bar leaves the flow.
  const pinned =
    state === "none"
      ? ""
      : "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:max-h-[45dvh] max-lg:overflow-y-auto max-lg:border-t max-lg:border-b-0 max-lg:bg-surface max-lg:px-4 max-lg:pt-2 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))]";
  return (
    <div className="min-h-12">
      <div className={`flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-2 ${pinned}`}>
        <Checkbox label={l.selectAll} hideLabel checked={state === "all"} indeterminate={state === "some"} onChange={onToggleAll} />
        {state === "none" ? (
          <p className="text-sm text-muted">{summary}</p>
        ) : (
          <>
            <p className="text-sm font-semibold tabular-nums">{format(l.selected, { count })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={onPause} disabled={!onPause} busy={busy}>
                <Pause aria-hidden="true" className="size-4" />
                {l.pause}
              </Button>
              <Button variant="secondary" onClick={onResume} disabled={!onResume} busy={busy}>
                <Play aria-hidden="true" className="size-4" />
                {l.resume}
              </Button>
              {onMove && (
                <Button variant="secondary" onClick={onMove} busy={busy}>
                  <FolderInput aria-hidden="true" className="size-4" />
                  {t.folders.moveAction}
                </Button>
              )}
              <Button variant="secondary" onClick={onDelete} busy={busy} className="text-danger">
                <Trash2 aria-hidden="true" className="size-4" />
                {l.delete}
              </Button>
              <Button variant="secondary" onClick={onClear} className="border-transparent text-muted">
                <X aria-hidden="true" className="size-4" />
                {l.clearSelection}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
