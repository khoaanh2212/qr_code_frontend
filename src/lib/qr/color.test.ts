import { describe, expect, it } from "vitest";
import { contrastRatio, isScannable, normalizeHex } from "./color";

describe("color", () => {
  it("computes WCAG contrast ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("needs a dark foreground on a light background with at least 3:1", () => {
    expect(isScannable("#000000", "#ffffff")).toBe(true);
    expect(isScannable("#1a237e", "#ffffff")).toBe(true);
    expect(isScannable("#ffffff", "#000000")).toBe(false);
    expect(isScannable("#eeeeee", "#ffffff")).toBe(false);
    expect(isScannable("#999999", "#ffffff")).toBe(false);
  });

  it.each([
    ["#ABCDEF", "#abcdef"],
    ["abcdef", "#abcdef"],
    ["#abc", null],
    ["#ggg000", null],
    ["", null],
  ])("normalizes %j", (input, want) => {
    expect(normalizeHex(input)).toBe(want);
  });
});
