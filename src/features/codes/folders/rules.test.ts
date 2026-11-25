import { describe, expect, it } from "vitest";
import { normalizeFolderName } from "./rules";

describe("normalizeFolderName", () => {
  it("trims, composes accents and collapses whitespace runs like the server", () => {
    expect(normalizeFolderName("  Menus \t\n  2024 ")).toBe("Menus 2024");
    expect(normalizeFolderName("e\u0301")).toBe("\u00e9");
    expect(normalizeFolderName("   ")).toBe("");
  });
});
