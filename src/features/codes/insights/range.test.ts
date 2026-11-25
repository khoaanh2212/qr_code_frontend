import { describe, expect, it } from "vitest";
import { MAX_RANGE_DAYS, bucketize, presetRange, totalsOf, validRange } from "./range";

const day = (d: string, scans: number, unique = scans) => ({ day: d, scans, unique_scans: unique });

describe("presetRange", () => {
  it("ends today (UTC) and spans the days it names, both ends included", () => {
    const now = new Date("2026-11-25T23:30:00Z");
    expect(presetRange(7, now)).toEqual({ from: "2026-11-19", to: "2026-11-25" });
    expect(presetRange(30, now)).toEqual({ from: "2026-10-27", to: "2026-11-25" });
    expect(presetRange(90, new Date("2026-03-01T00:00:00Z"))).toEqual({ from: "2025-12-02", to: "2026-03-01" });
  });
});

describe("validRange", () => {
  const today = "2026-11-25";
  it.each([
    ["one day", "2026-11-25", "2026-11-25", true],
    ["the longest span", "2025-11-25", "2026-11-25", true],
    ["a day too long", "2025-11-24", "2026-11-25", false],
    ["start after end", "2026-11-25", "2026-11-24", false],
    ["an end in the future", "2026-11-01", "2026-11-26", false],
    ["an empty start", "", "2026-11-25", false],
    ["a day that does not exist", "2026-02-30", "2026-03-01", false],
    ["another shape", "25/11/2026", "2026-11-25", false],
  ])("%s", (_name, from, to, ok) => {
    expect(validRange({ from, to }, today)).toBe(ok);
  });
  it("allows 366 days, as the API does", () => {
    expect(MAX_RANGE_DAYS).toBe(366);
  });
});

describe("bucketize", () => {
  const daily = [
    day("2026-10-30", 1), // Friday
    day("2026-10-31", 2, 1),
    day("2026-11-01", 3, 2), // Sunday
    day("2026-11-02", 4, 4), // Monday
    day("2026-11-03", 0, 0),
  ];

  it("keeps days as they are", () => {
    expect(bucketize(daily, "day")).toEqual([
      { start: "2026-10-30", end: "2026-10-30", scans: 1, unique: 1 },
      { start: "2026-10-31", end: "2026-10-31", scans: 2, unique: 1 },
      { start: "2026-11-01", end: "2026-11-01", scans: 3, unique: 2 },
      { start: "2026-11-02", end: "2026-11-02", scans: 4, unique: 4 },
      { start: "2026-11-03", end: "2026-11-03", scans: 0, unique: 0 },
    ]);
  });

  it("groups weeks from Monday, cut at the ends of the period", () => {
    expect(bucketize(daily, "week")).toEqual([
      { start: "2026-10-30", end: "2026-11-01", scans: 6, unique: 4 },
      { start: "2026-11-02", end: "2026-11-03", scans: 4, unique: 4 },
    ]);
  });

  it("groups calendar months", () => {
    expect(bucketize(daily, "month")).toEqual([
      { start: "2026-10-30", end: "2026-10-31", scans: 3, unique: 2 },
      { start: "2026-11-01", end: "2026-11-03", scans: 7, unique: 6 },
    ]);
  });

  it("puts days that arrive out of order back in order before grouping", () => {
    expect(bucketize([daily[3], daily[0], daily[2], daily[1]], "week")).toEqual([
      { start: "2026-10-30", end: "2026-11-01", scans: 6, unique: 4 },
      { start: "2026-11-02", end: "2026-11-02", scans: 4, unique: 4 },
    ]);
  });

  it("has nothing for no days", () => {
    expect(bucketize([], "week")).toEqual([]);
  });
});

describe("totalsOf", () => {
  it("adds up scans and the daily unique counts", () => {
    expect(totalsOf([day("2026-11-01", 3, 2), day("2026-11-02", 4, 4)])).toEqual({ scans: 7, unique: 6 });
    expect(totalsOf([])).toEqual({ scans: 0, unique: 0 });
  });
});
