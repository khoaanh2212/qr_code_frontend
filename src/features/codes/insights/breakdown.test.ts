import { describe, expect, it } from "vitest";
import { BROWSER_NAMES, OS_NAMES, countryName, familyName, rankByLabel, withRemainder } from "./breakdown";

describe("withRemainder", () => {
  it("adds what the API left out as one unknown entry, merged with its own", () => {
    expect(withRemainder([{ value: "VN", scans: 7 }], 10)).toEqual([
      { value: "VN", scans: 7 },
      { value: "", scans: 3 },
    ]);
    expect(withRemainder([{ value: "", scans: 2 }, { value: "VN", scans: 1 }], 5)).toEqual([
      { value: "", scans: 4 },
      { value: "VN", scans: 1 },
    ]);
    expect(withRemainder([{ value: "VN", scans: 12 }], 10)).toEqual([{ value: "VN", scans: 12 }]);
  });
});

describe("rankByLabel", () => {
  it("shows values that share a label as one row, most scans first", () => {
    const label = (v: string) => countryName(v, "en", "Unknown");
    expect(rankByLabel([{ value: "XX", scans: 5 }, { value: "VN", scans: 4 }, { value: "T1", scans: 2 }, { value: "de", scans: 1 }], 15, label)).toEqual([
      { value: "Unknown", scans: 11 }, // XX + T1 + "de" (not a code) + the 3 the API left out
      { value: "Vietnam", scans: 4 },
    ]);
  });
});

describe("names", () => {
  it("names countries in the page's language and leaves the rest unknown", () => {
    expect(countryName("VN", "en", "Unknown")).toBe("Vietnam");
    expect(countryName("DE", "de", "Unbekannt")).toBe("Deutschland");
    expect(countryName("", "en", "Unknown")).toBe("Unknown");
    expect(countryName("T1", "en", "Unknown")).toBe("Unknown");
  });

  it("names systems and browsers, and never reads a name off the prototype", () => {
    expect(familyName(OS_NAMES, "macos", "Other", "Unknown")).toBe("macOS");
    expect(familyName(BROWSER_NAMES, "samsung", "Other", "Unknown")).toBe("Samsung Internet");
    expect(familyName(OS_NAMES, "other", "Other", "Unknown")).toBe("Other");
    expect(familyName(OS_NAMES, "constructor", "Other", "Unknown")).toBe("Unknown");
    expect(familyName(OS_NAMES, "__proto__", "Other", "Unknown")).toBe("Unknown");
  });
});
