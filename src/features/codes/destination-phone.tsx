"use client";

import { Globe } from "lucide-react";
import { useId } from "react";

/**
 * What a scan of a code that redirects opens, in the phone frame hosted pages use for their
 * preview: the address as text in a browser bar (never a link), or a hint until there is one.
 */
export function DestinationPhone({ label, empty, address }: { label: string; empty: string; address: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col items-center gap-3">
      <div className="relative flex aspect-[9/19] w-full max-w-[18rem] flex-col overflow-hidden rounded-[2.25rem] border-[10px] border-foreground bg-white">
        <div className="m-3 flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs">
          <Globe aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
          <span className={`truncate ${address ? "text-foreground" : "text-muted"}`} title={address || undefined}>
            {address || empty}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Globe aria-hidden="true" className="size-16 text-border" strokeWidth={1} />
        </div>
      </div>
      <h3 id={id} className="max-w-[18rem] text-center text-xs text-pretty text-muted">
        {label}
      </h3>
    </section>
  );
}
