/** Dates and relative times in the page's language (Intl, no library). */

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/**
 * "5 minutes ago", "yesterday", "in 2 hours"; anything within 30 seconds is "now". An invalid
 * date gives "" rather than throwing during render.
 */
export function formatRelative(iso: string, locale: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let value = (ms - now.getTime()) / 1000;
  if (Math.abs(value) < 30) return rtf.format(0, "second");
  for (const [unit, size] of STEPS) {
    // Round first, so 59.6 minutes becomes "1 hour ago", not "60 minutes ago".
    if (Math.abs(Math.round(value)) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return rtf.format(Math.round(value), "year");
}

/** "November 23, 2026" / "23. November 2026"; "" for an invalid date. */
export function formatDate(iso: string, locale: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone }).format(date);
}
