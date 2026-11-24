"use client";

import { useId, useState } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { CodeStats } from "@/lib/api/types";

type Day = CodeStats["daily"][number];

/** "2026-11-24" as a short date in the UTC calendar (the API's days are UTC days). */
export function dayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/**
 * Scans per day as thin bars (one series, so no legend: the section title names it). Hovering a
 * day shows its numbers; the same numbers are available as a table for keyboards and screen
 * readers, so the bars themselves are hidden from assistive technology.
 */
export function ScanChart({ t, locale, daily }: { t: Messages["codes"]; locale: Locale; daily: Day[] }) {
  const tableId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...daily.map((d) => d.scans));
  const nf = new Intl.NumberFormat(locale);
  const tip = (d: Day) =>
    format(t.dayScans, { day: dayLabel(d.day, locale), count: nf.format(d.scans), unique: nf.format(d.unique_scans) });
  const active = hover === null ? null : daily[hover];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{t.chartLabel}</figcaption>
      <div aria-hidden="true" className="relative">
        <span className="absolute -top-1 left-0 text-xs text-muted tabular-nums">{nf.format(max)}</span>
        <div
          className="flex h-40 items-end gap-[2px] border-b border-border pt-5"
          onMouseLeave={() => setHover(null)}
        >
          {daily.map((d, i) => (
            <div
              key={d.day}
              className="flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setHover(i)}
            >
              <div
                className={`w-full rounded-t-[4px] bg-accent transition-opacity duration-100 ${
                  hover !== null && hover !== i ? "opacity-50" : ""
                }`}
                // A day with scans always shows at least a sliver; an empty day shows nothing.
                style={{ height: d.scans === 0 ? 0 : `max(2px, ${(d.scans / max) * 100}%)` }}
              />
            </div>
          ))}
        </div>
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-sm"
            style={
              hover < daily.length / 2
                ? { left: `${(hover / daily.length) * 100}%` }
                : { right: `${((daily.length - hover - 1) / daily.length) * 100}%` }
            }
          >
            {tip(active)}
          </div>
        )}
        {daily.length > 0 && (
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{dayLabel(daily[0].day, locale)}</span>
            <span>{dayLabel(daily[daily.length - 1].day, locale)}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((v) => !v)}
        className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
      >
        {t.tableToggle}
      </button>
      <div
        id={tableId}
        hidden={!showTable}
        // Scrollable, so it must be reachable by keyboard.
        tabIndex={0}
        role="region"
        aria-label={t.chartLabel}
        className="max-h-80 overflow-y-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">{t.chartLabel}</caption>
          <thead className="sticky top-0 bg-surface text-left text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">{t.day}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t.scansColumn}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t.uniqueColumn}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {daily.map((d) => (
              <tr key={d.day}>
                <th scope="row" className="px-3 py-1.5 text-left font-normal">{dayLabel(d.day, locale)}</th>
                <td className="px-3 py-1.5 text-right">{nf.format(d.scans)}</td>
                <td className="px-3 py-1.5 text-right">{nf.format(d.unique_scans)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** A short ranked list (top countries, devices) with a thin proportional bar under each row. */
export function TopList({
  title,
  entries,
  label,
  locale,
}: {
  title: string;
  entries: { value: string; scans: number }[];
  label: (value: string) => string;
  locale: Locale;
}) {
  const nf = new Intl.NumberFormat(locale);
  const top = entries.slice(0, 5);
  const max = Math.max(1, ...top.map((e) => e.scans));
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
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
    </div>
  );
}
