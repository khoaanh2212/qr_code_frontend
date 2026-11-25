import type { Campaign, CampaignMedium } from "@/lib/api/types";

/** These lists and limits mirror the backend (backend PLAN item 55); the server stays the authority. */
export const PRINT_MEDIA = [
  "poster",
  "flyer",
  "brochure",
  "business_card",
  "packaging",
  "product_label",
  "magazine",
  "newspaper",
  "billboard",
  "signage",
  "menu",
  "sticker",
] as const satisfies readonly CampaignMedium[];

export const DIGITAL_MEDIA = ["website", "email", "social_media", "presentation", "video"] as const satisfies readonly CampaignMedium[];

/** The medium that comes with a label of the customer's own. */
export const OTHER_MEDIUM = "other" satisfies CampaignMedium;

export const CAMPAIGN_LIMITS = {
  minDate: "2000-01-01",
  maxDate: "2100-12-31",
  minPrintRun: 1,
  maxPrintRun: 100_000_000,
  labelMax: 40,
} as const;

export const EMPTY_CAMPAIGN: Readonly<Campaign> = Object.freeze({ start_date: null, end_date: null, print_run: null, medium: null, medium_other: null });

/** The campaign as the form holds it: every field a string, "" for not set. */
export interface CampaignDraft {
  start: string;
  end: string;
  printRun: string;
  medium: CampaignMedium | "";
  other: string;
}

/** The API's names of the fields that can be wrong, as in its `campaign.<field>` errors. */
export type CampaignField = "start_date" | "end_date" | "print_run" | "medium_other";

export type CampaignProblem = "endBeforeStart" | "dateRange" | "printRun" | "otherRequired" | "otherInvalid";

export function draftOf(c: Campaign): CampaignDraft {
  return {
    start: c.start_date ?? "",
    end: c.end_date ?? "",
    printRun: c.print_run === null ? "" : String(c.print_run),
    medium: c.medium ?? "",
    other: c.medium_other ?? "",
  };
}

/**
 * A label as the server stores it (NFC, whitespace runs collapsed to one space, trimmed), so the
 * length counted here is the length the server counts.
 */
function normalizeLabel(label: string): string {
  return label.normalize("NFC").trim().replace(/\s+/g, " ");
}

// Control characters (tabs and line breaks included), bidi embeddings, overrides and isolates,
// zero-width space, word joiner, byte order mark, line and paragraph separators: what the server
// refuses in a label. Checked before whitespace is collapsed, like the server (the two trims
// differ only for a byte order mark or a next-line character at the very edge).
const HIDDEN = /[\p{Cc}\u202A-\u202E\u2066-\u2069\u200B\u2060\uFEFF\u2028\u2029]/u;

function validDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (day < CAMPAIGN_LIMITS.minDate || day > CAMPAIGN_LIMITS.maxDate) return false;
  // Date.UTC rolls an impossible day over (30 February becomes 2 March): the round trip tells.
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

/** The first problem of the form, in field order; null when it can be sent. */
export function validateCampaign(d: CampaignDraft): { field: CampaignField; problem: CampaignProblem } | null {
  if (d.start && !validDay(d.start)) return { field: "start_date", problem: "dateRange" };
  if (d.end && !validDay(d.end)) return { field: "end_date", problem: "dateRange" };
  if (d.start && d.end && d.end < d.start) return { field: "end_date", problem: "endBeforeStart" };
  const run = d.printRun.trim();
  if (run) {
    // Digits only: Number() would also take "1e5", "0x10" and "1.0".
    const n = /^\d{1,9}$/.test(run) ? Number(run) : NaN;
    if (!(n >= CAMPAIGN_LIMITS.minPrintRun && n <= CAMPAIGN_LIMITS.maxPrintRun)) return { field: "print_run", problem: "printRun" };
  }
  if (d.medium === OTHER_MEDIUM) {
    const trimmed = d.other.normalize("NFC").trim();
    if (!trimmed) return { field: "medium_other", problem: "otherRequired" };
    if (HIDDEN.test(trimmed) || [...normalizeLabel(trimmed)].length > CAMPAIGN_LIMITS.labelMax)
      return { field: "medium_other", problem: "otherInvalid" };
  }
  return null;
}

/**
 * What a valid form asks for: the whole campaign, or null when nothing is set (the API clears all
 * details on null). A label left over from another medium is dropped, as the field is hidden then.
 * Only for a draft that `validateCampaign` accepted: nothing is checked here.
 */
export function campaignOf(d: CampaignDraft): Campaign | null {
  const run = d.printRun.trim();
  const campaign: Campaign = {
    start_date: d.start || null,
    end_date: d.end || null,
    print_run: run ? Number(run) : null,
    medium: d.medium || null,
    medium_other: d.medium === OTHER_MEDIUM ? normalizeLabel(d.other) : null,
  };
  return isEmptyCampaign(campaign) ? null : campaign;
}

export function isEmptyCampaign(c: Readonly<Campaign>): boolean {
  return sameCampaign(c, EMPTY_CAMPAIGN);
}

export function sameCampaign(a: Readonly<Campaign>, b: Readonly<Campaign>): boolean {
  return (
    a.start_date === b.start_date &&
    a.end_date === b.end_date &&
    a.print_run === b.print_run &&
    a.medium === b.medium &&
    a.medium_other === b.medium_other
  );
}
