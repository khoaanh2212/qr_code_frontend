"use client";

import { useId } from "react";
import type { Locale } from "@/i18n/config";

/** "2026-11-24" as a short date in the UTC calendar (the API's days are UTC days). */
export function dayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/**
 * A short ranked list (top countries, devices, systems) with a thin proportional bar under each
 * row. A region named by its title, so it can be found among its siblings.
 */
export function TopList({
  title,
  entries,
  label,
  locale,
  limit = 5,
}: {
  title: string;
  entries: { value: string; scans: number }[];
  label: (value: string) => string;
  locale: Locale;
  limit?: number;
}) {
  const id = useId();
  const nf = new Intl.NumberFormat(locale);
  const top = entries.slice(0, limit);
  const max = Math.max(1, ...top.map((e) => e.scans));
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      <ol className="flex flex-col gap-2">
        {top.map((e) => (
          <li key={e.value} className="flex flex-col gap-1 text-sm">
            <span className="flex justify-between gap-3">
              <span className="truncate">{label(e.value)}</span>
              <span className="text-muted tabular-nums">{nf.format(e.scans)}</span>
            </span>
            <span aria-hidden="true" className="h-1 rounded-full bg-foreground/5">
              <span className="block h-1 rounded-full bg-accent" style={{ width: `${(e.scans / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
