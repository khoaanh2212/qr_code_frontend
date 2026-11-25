import type { CodeStats } from "@/lib/api/types";

/** The API's days are UTC days, and so is everything here. */
type Day = CodeStats["daily"][number];

/** The longest period the stats API answers (backend PLAN item 37). */
export const MAX_RANGE_DAYS = 366;

export const PRESET_DAYS = [7, 30, 90] as const;
export type PresetDays = (typeof PRESET_DAYS)[number];

export interface Range {
  from: string;
  to: string;
}

export type Bucket = "day" | "week" | "month";

/** One bar of the chart and one row of the export: a day, or the days of a week or month in the period. */
export interface Period {
  start: string;
  end: string;
  scans: number;
  /** The sum of the days' unique counts: a device that scans on two days counts twice. */
  unique: number;
}

const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (day: string) => new Date(`${day}T00:00:00Z`);

/** Today as the API counts it. */
export function utcToday(now = new Date()): string {
  return iso(now);
}

/** The last `days` UTC days, today included. */
export function presetRange(days: PresetDays, now = new Date()): Range {
  const to = utcToday(now);
  return { from: iso(new Date(at(to).getTime() - (days - 1) * DAY_MS)), to };
}

function realDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = at(day);
  return !Number.isNaN(d.getTime()) && iso(d) === day; // 30 February rolls over: the round trip tells
}

/** Whether the API takes the period: real days, start not after end, at most MAX_RANGE_DAYS, nothing after today. */
export function validRange({ from, to }: Range, today = utcToday()): boolean {
  if (!realDay(from) || !realDay(to) || from > to || to > today) return false;
  return (at(to).getTime() - at(from).getTime()) / DAY_MS + 1 <= MAX_RANGE_DAYS;
}

/** What groups a day: itself, the Monday of its week, or its month. */
function keyOf(day: string, bucket: Bucket): string {
  if (bucket === "day") return day;
  if (bucket === "month") return day.slice(0, 7);
  const d = at(day);
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  return iso(new Date(d.getTime() - sinceMonday * DAY_MS));
}

/**
 * The days of a period grouped by day, week (from Monday) or calendar month, in order. A group at
 * either end holds only the days the period has, and says so with its own start and end.
 */
export function bucketize(daily: readonly Day[], bucket: Bucket): Period[] {
  const out: Period[] = [];
  let key: string | null = null;
  // The API lists the days in order; sorted here all the same, so a group is never split.
  for (const d of [...daily].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))) {
    const k = keyOf(d.day, bucket);
    const last = out.at(-1);
    if (last && k === key) {
      last.end = d.day;
      last.scans += d.scans;
      last.unique += d.unique_scans;
    } else {
      out.push({ start: d.day, end: d.day, scans: d.scans, unique: d.unique_scans });
      key = k;
    }
  }
  return out;
}

export function totalsOf(daily: readonly Day[]): { scans: number; unique: number } {
  return daily.reduce((sum, d) => ({ scans: sum.scans + d.scans, unique: sum.unique + d.unique_scans }), { scans: 0, unique: 0 });
}

/**
 * A cell for a spreadsheet: quoted, quotes doubled, and one that begins like a formula (`=`, `+`,
 * `-`, `@`, tab, carriage return) defused with a leading apostrophe, as the backend's exports do.
 */
function cell(value: string | number): string {
  const text = String(value);
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** The periods as CSV (RFC 4180: CRLF line ends, every cell quoted), under the given headings. */
export function csvOf(rows: readonly Period[], headings: Record<keyof Period, string>): string {
  const lines = [
    [headings.start, headings.end, headings.scans, headings.unique],
    ...rows.map((r) => [r.start, r.end, r.scans, r.unique]),
  ];
  return lines.map((line) => line.map(cell).join(",")).join("\r\n") + "\r\n";
}
