import { describe, expect, it } from "vitest";
import { plural } from "./plural";

const forms = { one: "{count} code", other: "{count} codes" };

describe("plural", () => {
  it("picks the form by the locale's plural rules and fills {count}", () => {
    expect(plural("en", forms, 1)).toBe("1 code");
    expect(plural("en", forms, 3)).toBe("3 codes");
    expect(plural("en", forms, 0)).toBe("0 codes");
    // French treats 0 as singular.
    expect(plural("fr", { one: "{count} code", other: "{count} codes" }, 0)).toBe("0 code");
  });

  it("falls back to `other` when a language has no `one` form", () => {
    expect(plural("vi", { other: "{count} mã" }, 1)).toBe("1 mã");
  });

  it("fills extra placeholders", () => {
    expect(plural("en", { other: "{count} of {total}" }, 2, { total: 9 })).toBe("2 of 9");
  });
});
