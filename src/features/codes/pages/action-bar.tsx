import type { ReactNode } from "react";

/**
 * The actions of a page that edits something, in a bar fixed to the bottom edge at every width
 * (DESIGN.md, "Layout"): the way back first, the primary action last. The page keeps room below
 * its content so nothing ends under the bar.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}

/** Room under a page's content for the ActionBar. */
export const ACTION_BAR_ROOM = "pb-[calc(9rem+env(safe-area-inset-bottom))]";
