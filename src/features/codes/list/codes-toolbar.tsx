"use client";

import { LayoutGrid, List, Pause, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { CodeQuery, CodeSort, StatusFilter } from "./query";
import type { CodesView } from "./use-codes-view";
import type { SelectionState } from "./use-selection";

export interface CodesToolbarProps {
  t: Messages["codes"];
  query: CodeQuery;
  onQueryChange: (query: CodeQuery) => void;
  view: CodesView;
  onViewChange: (view: CodesView) => void;
}

/** Search, status filter, order and layout of the codes list. Controlled: the list owns the query. */
export function CodesToolbar({ t, query, onQueryChange, view, onViewChange }: CodesToolbarProps) {
  const l = t.list;
  const statuses: { value: StatusFilter; label: string }[] = [
    { value: "all", label: l.statusAll },
    { value: "active", label: t.status.active },
    { value: "paused", label: t.status.paused },
    { value: "locked", label: t.status.locked },
  ];
  const sorts: { value: CodeSort; label: string }[] = [
    { value: "newest", label: l.sortNewest },
    { value: "oldest", label: l.sortOldest },
    { value: "name", label: l.sortName },
  ];
  return (
    <div role="search" className="flex flex-wrap items-center gap-2 sm:gap-3">
      <SearchField
        label={l.search}
        placeholder={l.searchPlaceholder}
        value={query.search}
        onValueChange={(search) => onQueryChange({ ...query, search })}
        className="min-w-0 basis-full sm:basis-72 sm:grow"
      />
      <Select label={l.statusFilter} hideLabel value={query.status} options={statuses} onChange={(status) => onQueryChange({ ...query, status })} />
      <Select label={l.sort} hideLabel value={query.sort} options={sorts} onChange={(sort) => onQueryChange({ ...query, sort })} />
      <div className="ml-auto">
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
  onDelete: () => void;
  busy: boolean;
}

/** The row above the codes: select all, the count, and what can be done to the selection. */
export function SelectionBar({ t, state, count, summary, onToggleAll, onClear, onPause, onResume, onDelete, busy }: SelectionBarProps) {
  const l = t.list;
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-2">
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
  );
}
