"use client";

import { useId, useState } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { dayLabel } from "../scan-chart";
import type { Period } from "./range";

/** Above this many bars the chart drops the gaps between them. */
const DENSE = 62;

/** "Nov 24" for one day, "Nov 24 – Nov 30" for several. */
export function periodLabel(p: Period, locale: Locale): string {
  return p.start === p.end ? dayLabel(p.start, locale) : `${dayLabel(p.start, locale)} – ${dayLabel(p.end, locale)}`;
}

/**
 * Scans per period as bars: the unique scans in Signal Teal with the repeated ones stacked above
 * in its soft tint, named by a legend. Hovering a bar shows its numbers; the same numbers are
 * available as a table for keyboards and screen readers, so the bars themselves are hidden from
 * assistive technology.
 */
export function PeriodChart({ t, locale, periods }: { t: Messages["codes"]; locale: Locale; periods: Period[] }) {
  const i = t.insights;
  const tableId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...periods.map((p) => p.scans));
  const nf = new Intl.NumberFormat(locale);
  const active = hover === null ? null : (periods[hover] ?? null);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{i.chartLabel}</figcaption>
      <div aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-accent" />
          {i.legendUnique}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-accent/35" />
          {i.legendRepeat}
        </span>
      </div>
      <div aria-hidden="true" className="relative">
        <span className="absolute -top-1 left-0 text-xs text-muted tabular-nums">{nf.format(max)}</span>
        {/* Many bars (a year of days) stand shoulder to shoulder: gaps alone would be wider than a phone. */}
        <div
          className={`flex h-44 items-end overflow-hidden border-b border-border pt-5 ${periods.length > DENSE ? "" : "gap-[2px]"}`}
          onMouseLeave={() => setHover(null)}
        >
          {periods.map((p, index) => (
            // A tap shows the same numbers as hovering does.
            <div key={p.start} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(index)} onClick={() => setHover(index)}>
              <div
                className={`flex w-full flex-col overflow-hidden transition-opacity duration-100 ${periods.length > DENSE ? "" : "rounded-t-[4px]"} ${
                  hover !== null && hover !== index ? "opacity-50" : ""
                }`}
                // A period with scans always shows at least a sliver; an empty one shows nothing.
                style={{ height: p.scans === 0 ? 0 : `max(2px, ${(p.scans / max) * 100}%)` }}
              >
                <div className="bg-accent/35" style={{ flexGrow: Math.max(0, p.scans - p.unique) }} />
                <div className="bg-accent" style={{ flexGrow: p.unique }} />
              </div>
            </div>
          ))}
        </div>
        {active && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-sm"
            style={
              hover < periods.length / 2
                ? { left: `${(hover / periods.length) * 100}%` }
                : { right: `${((periods.length - hover - 1) / periods.length) * 100}%` }
            }
          >
            {format(i.periodTip, { period: periodLabel(active, locale), count: nf.format(active.scans), unique: nf.format(active.unique) })}
          </div>
        )}
        {periods.length > 0 && (
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{dayLabel(periods[0].start, locale)}</span>
            <span>{dayLabel(periods[periods.length - 1].end, locale)}</span>
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
        aria-label={i.chartLabel}
        className="max-h-80 overflow-y-auto rounded-md border border-border"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{i.chartLabel}</caption>
          <thead className="sticky top-0 bg-surface text-left text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {i.period}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.scansColumn}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t.uniqueColumn}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {periods.map((p) => (
              <tr key={p.start}>
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  {periodLabel(p, locale)}
                </th>
                <td className="px-3 py-1.5 text-right">{nf.format(p.scans)}</td>
                <td className="px-3 py-1.5 text-right">{nf.format(p.unique)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
