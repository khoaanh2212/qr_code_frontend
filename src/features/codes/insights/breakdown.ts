import type { Locale } from "@/i18n/config";
import type { CodeStats } from "@/lib/api/types";

type Entries = CodeStats["countries"];

/** ISO 3166 alpha-2 as a country name in the page's language; anything else is "Unknown". */
export function countryName(value: string, locale: Locale, unknown: string): string {
  if (!/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") return unknown;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(value) ?? value;
  } catch {
    return value;
  }
}

/** Scans the API left out of a breakdown (e.g. no known country) become one "" (unknown) entry. */
export function withRemainder(entries: Entries, total: number): Entries {
  const rest = total - entries.reduce((sum, e) => sum + e.scans, 0);
  if (rest <= 0) return entries;
  const known = entries.filter((e) => e.value !== "");
  const unknown = rest + (entries.find((e) => e.value === "")?.scans ?? 0);
  return [...known, { value: "", scans: unknown }].sort((a, b) => b.scans - a.scans);
}

/**
 * A breakdown as rows to show: every scan of the total accounted for (see `withRemainder`), each
 * value under its label, and values that share a label (several codes that all read "Unknown")
 * added up into one row. Most scans first.
 */
export function rankByLabel(entries: Entries, total: number, label: (value: string) => string): Entries {
  const sums = new Map<string, number>();
  for (const e of withRemainder(entries, total)) {
    const name = label(e.value);
    sums.set(name, (sums.get(name) ?? 0) + e.scans);
  }
  return [...sums].map(([value, scans]) => ({ value, scans })).sort((a, b) => b.scans - a.scans);
}

/** Product names of the systems and browsers the API tells apart (its "other" is translated). */
export const OS_NAMES: Readonly<Record<string, string>> = {
  ios: "iOS",
  android: "Android",
  chromeos: "ChromeOS",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

export const BROWSER_NAMES: Readonly<Record<string, string>> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  samsung: "Samsung Internet",
};

/** A family's product name, "Other" for the API's catch-all, "Unknown" for anything else. */
export function familyName(names: Readonly<Record<string, string>>, value: string, other: string, unknown: string): string {
  if (Object.hasOwn(names, value)) return names[value];
  return value === "other" ? other : unknown;
}
