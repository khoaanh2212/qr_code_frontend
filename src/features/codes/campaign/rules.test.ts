import { describe, expect, it } from "vitest";
import type { Campaign } from "@/lib/api/types";
import {
  CAMPAIGN_LIMITS,
  DIGITAL_MEDIA,
  EMPTY_CAMPAIGN,
  PRINT_MEDIA,
  campaignOf,
  draftOf,
  isEmptyCampaign,
  sameCampaign,
  validateCampaign,
  type CampaignDraft,
} from "./rules";

const draft = (over: Partial<CampaignDraft> = {}): CampaignDraft => ({ start: "", end: "", printRun: "", medium: "", other: "", ...over });

describe("campaign media", () => {
  it("lists the backend's 12 print and 5 digital media once each, other apart", () => {
    expect(PRINT_MEDIA).toHaveLength(12);
    expect(DIGITAL_MEDIA).toHaveLength(5);
    expect(new Set([...PRINT_MEDIA, ...DIGITAL_MEDIA, "other"]).size).toBe(18);
  });
});

describe("draftOf and campaignOf", () => {
  const full: Campaign = { start_date: "2026-12-01", end_date: "2026-12-31", print_run: 5000, medium: "other", medium_other: "Trade fair" };

  it("round-trips a full campaign through the form", () => {
    expect(draftOf(full)).toEqual({ start: "2026-12-01", end: "2026-12-31", printRun: "5000", medium: "other", other: "Trade fair" });
    expect(campaignOf(draftOf(full))).toEqual(full);
  });

  it("turns empty fields into null, and an empty form into no campaign", () => {
    expect(draftOf(EMPTY_CAMPAIGN)).toEqual(draft());
    expect(campaignOf(draft())).toBeNull();
    expect(campaignOf(draft({ printRun: "  " }))).toBeNull();
    expect(campaignOf(draft({ start: "2026-01-01" }))).toEqual({ ...EMPTY_CAMPAIGN, start_date: "2026-01-01" });
    expect(campaignOf(draft({ printRun: " 12 " }))).toEqual({ ...EMPTY_CAMPAIGN, print_run: 12 });
  });

  it("stores the label as the server does and drops it without the medium other", () => {
    expect(campaignOf(draft({ medium: "other", other: "  Trade \u00A0  fair " }))?.medium_other).toBe("Trade fair");
    expect(campaignOf(draft({ medium: "other", other: "e\u0301" }))?.medium_other).toBe("\u00E9");
    expect(campaignOf(draft({ medium: "poster", other: "left over" }))).toEqual({ ...EMPTY_CAMPAIGN, medium: "poster" });
  });
});

describe("validateCampaign", () => {
  it.each<[string, Partial<CampaignDraft>]>([
    ["nothing", {}],
    ["a start alone", { start: "2026-01-01" }],
    ["an end alone", { end: "2026-01-01" }],
    ["the same day", { start: "2026-05-05", end: "2026-05-05" }],
    ["a leap day", { start: "2028-02-29" }],
    ["the first and last allowed days", { start: CAMPAIGN_LIMITS.minDate, end: CAMPAIGN_LIMITS.maxDate }],
    ["the smallest print run", { printRun: "1" }],
    ["the largest print run", { printRun: String(CAMPAIGN_LIMITS.maxPrintRun) }],
    ["a medium", { medium: "social_media" }],
    ["other with a label of 40 characters", { medium: "other", other: "\u00EA".repeat(40) }],
    ["a label left over from another medium", { medium: "poster", other: "x".repeat(60) }],
    ["a label that fits once its spaces are collapsed", { medium: "other", other: `${"a".repeat(20)}    ${"b".repeat(19)}` }],
    ["a label of 40 characters outside the basic plane", { medium: "other", other: "\u{1F35C}".repeat(40) }],
    ["a print run with leading zeros and spaces around", { printRun: " 007 " }],
    ["the first day of the last year", { start: "2100-01-01" }],
  ])("accepts %s", (_name, over) => {
    expect(validateCampaign(draft(over))).toBeNull();
  });

  it.each<[string, Partial<CampaignDraft>, string, string]>([
    ["an end before the start", { start: "2026-02-02", end: "2026-02-01" }, "end_date", "endBeforeStart"],
    ["a day that does not exist", { start: "2027-02-29" }, "start_date", "dateRange"],
    ["a start before 2000", { start: "1999-12-31" }, "start_date", "dateRange"],
    ["an end after 2100", { end: "2101-01-01" }, "end_date", "dateRange"],
    ["a date in another shape", { end: "01/12/2026" }, "end_date", "dateRange"],
    ["a print run of zero", { printRun: "0" }, "print_run", "printRun"],
    ["a print run above the limit", { printRun: "100000001" }, "print_run", "printRun"],
    ["a fractional print run", { printRun: "1.5" }, "print_run", "printRun"],
    ["a print run in exponent form", { printRun: "1e5" }, "print_run", "printRun"],
    ["a negative print run", { printRun: "-3" }, "print_run", "printRun"],
    ["other without a label", { medium: "other" }, "medium_other", "otherRequired"],
    ["other with a blank label", { medium: "other", other: "   " }, "medium_other", "otherRequired"],
    ["a label of 41 characters", { medium: "other", other: "\u00EA".repeat(41) }, "medium_other", "otherInvalid"],
    ["a label with a line break", { medium: "other", other: "a\nb" }, "medium_other", "otherInvalid"],
    ["a label with a direction override", { medium: "other", other: "a\u202Eb" }, "medium_other", "otherInvalid"],
    ["a label with a zero-width space", { medium: "other", other: "a\u200Bb" }, "medium_other", "otherInvalid"],
    ["a label with a tab inside", { medium: "other", other: "a\tb" }, "medium_other", "otherInvalid"],
    ["a label with an isolate", { medium: "other", other: "a\u2066b" }, "medium_other", "otherInvalid"],
    ["a label with a word joiner", { medium: "other", other: "a\u2060b" }, "medium_other", "otherInvalid"],
    ["a label with a paragraph separator", { medium: "other", other: "a\u2029b" }, "medium_other", "otherInvalid"],
    ["a label with a delete character", { medium: "other", other: "a\u007Fb" }, "medium_other", "otherInvalid"],
    ["a label of 41 characters outside the basic plane", { medium: "other", other: "\u{1F35C}".repeat(41) }, "medium_other", "otherInvalid"],
    ["a label of non-breaking spaces only", { medium: "other", other: "\u00A0\u00A0" }, "medium_other", "otherRequired"],
    ["a print run of ten digits", { printRun: "1000000000" }, "print_run", "printRun"],
    ["a print run in other digits", { printRun: "\u0661\u0662" }, "print_run", "printRun"],
    ["a month that does not exist", { start: "2000-00-10" }, "start_date", "dateRange"],
    ["a day past the end of the year", { end: "2100-12-32" }, "end_date", "dateRange"],
  ])("refuses %s", (_name, over, field, problem) => {
    expect(validateCampaign(draft(over))).toEqual({ field, problem });
  });

  it("reports the first problem in form order", () => {
    expect(validateCampaign(draft({ start: "1999-01-01", printRun: "0" }))?.field).toBe("start_date");
  });
});

describe("sameCampaign and isEmptyCampaign", () => {
  it("compares field by field", () => {
    const a: Campaign = { ...EMPTY_CAMPAIGN, print_run: 5 };
    expect(sameCampaign(a, { ...a })).toBe(true);
    expect(sameCampaign(a, { ...a, medium: "flyer" })).toBe(false);
    expect(isEmptyCampaign(EMPTY_CAMPAIGN)).toBe(true);
    expect(isEmptyCampaign(a)).toBe(false);
  });
});
