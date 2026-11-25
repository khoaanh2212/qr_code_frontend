"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The frame of the logged-in app: masthead and main area. The codes list (the app's index, no
 * child segment) spans the viewport and lays out its own columns; every other page keeps the
 * centered column (DESIGN.md, "Layout"). One frame for both, so the masthead and the session
 * guard stay mounted when moving between the list and a page.
 */
export function AppFrame({ masthead, children }: { masthead: ReactNode; children: ReactNode }) {
  const wide = useSelectedLayoutSegment() === null;
  return (
    <>
      <header className="border-b border-border bg-header">
        <nav className={`flex items-center justify-between gap-2 px-4 py-3 ${wide ? "lg:px-6" : "mx-auto max-w-6xl"}`}>{masthead}</nav>
      </header>
      <main className={wide ? "flex w-full flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-6"}>{children}</main>
    </>
  );
}
