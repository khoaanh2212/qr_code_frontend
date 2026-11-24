import { describe, expect, it } from "vitest";
import { formatDate, formatRelative } from "./time";

const now = new Date("2026-11-23T12:00:00Z");

describe("formatRelative", () => {
  it.each([
    ["2026-11-23T11:59:40Z", "en", "now"],
    ["2026-11-23T11:55:00Z", "en", "5 minutes ago"],
    ["2026-11-23T09:00:00Z", "en", "3 hours ago"],
    ["2026-11-22T12:00:00Z", "en", "yesterday"],
    ["2026-11-10T12:00:00Z", "en", "2 weeks ago"],
    ["2026-11-23T09:00:00Z", "vi", "3 giờ trước"],
    ["2026-11-23T11:00:24Z", "en", "1 hour ago"],
    ["2026-11-23T14:00:00Z", "en", "in 2 hours"],
    ["2026-11-23T12:00:29Z", "en", "now"],
    ["not a date", "en", ""],
  ])("%s in %s", (iso, locale, want) => {
    expect(formatRelative(iso, locale, now)).toBe(want);
  });
});

describe("formatDate", () => {
  it("uses the locale's date style", () => {
    expect(formatDate("2026-11-23T12:00:00Z", "en", "UTC")).toBe("November 23, 2026");
    expect(formatDate("2026-11-23T12:00:00Z", "de", "UTC")).toBe("23. November 2026");
    expect(formatDate("garbage", "en")).toBe("");
  });
});
