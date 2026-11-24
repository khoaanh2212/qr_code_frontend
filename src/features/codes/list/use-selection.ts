"use client";

import { useCallback, useMemo, useState } from "react";

export type SelectionState = "none" | "some" | "all";

export interface Selection {
  /** Selected ids among the visible ones only: a code hidden by a filter is never acted on. */
  ids: ReadonlySet<string>;
  state: SelectionState;
  has: (id: string) => boolean;
  toggle: (id: string, on: boolean) => void;
  /** Selects every visible id, or none when all are already selected. */
  toggleAll: () => void;
  /** Replaces the selection (e.g. with the ids an action failed on). */
  set: (ids: Iterable<string>) => void;
  clear: () => void;
}

/** Multi-selection over a list whose visible items change with filters and paging. */
export function useSelection(visibleIds: readonly string[]): Selection {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  // When the visible codes change (a filter answered, codes deleted), ids no longer visible
  // leave the selection for good: clearing the filter must not bring them back selected.
  const [seen, setSeen] = useState(visibleIds);
  if (seen !== visibleIds) {
    setSeen(visibleIds);
    const now = new Set(visibleIds);
    if ([...picked].some((id) => !now.has(id))) setPicked(new Set([...picked].filter((id) => now.has(id))));
  }
  const visible = useMemo(() => new Set(visibleIds), [visibleIds]);
  const ids = useMemo(() => new Set([...picked].filter((id) => visible.has(id))), [picked, visible]);
  const state: SelectionState = ids.size === 0 ? "none" : ids.size === visible.size ? "all" : "some";

  const toggle = useCallback(
    (id: string, on: boolean) =>
      setPicked((prev) => {
        // Keep only visible ids: a code hidden by a filter leaves the selection at the next change.
        const next = new Set([...prev].filter((x) => visible.has(x)));
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [visible],
  );
  const toggleAll = useCallback(() => setPicked(state === "all" ? new Set() : new Set(visible)), [state, visible]);
  const set = useCallback((next: Iterable<string>) => setPicked(new Set(next)), []);
  const clear = useCallback(() => setPicked(new Set()), []);

  return { ids, state, has: (id) => ids.has(id), toggle, toggleAll, set, clear };
}
