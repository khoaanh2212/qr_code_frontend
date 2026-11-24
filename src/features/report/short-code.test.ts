import { describe, expect, it } from "vitest";
import { parseShortCode } from "./short-code";

describe("parseShortCode", () => {
  it.each([
    ["AbCd1234", "AbCd1234"],
    ["  AbCd1234 ", "AbCd1234"],
    ["https://s.proofqr.app/AbCd1234", "AbCd1234"],
    ["s.proofqr.app/AbCd1234/", "AbCd1234"],
    ["http://localhost:8180/AbCd1234?utm=x#top", "AbCd1234"],
  ])("finds the code in %j", (input, code) => {
    expect(parseShortCode(input)).toBe(code);
  });

  it.each(["", "   ", "AbCd123", "AbCd12345", "AbCd-234", "https://s.proofqr.app/", "https://example.com/menu"])(
    "rejects %j",
    (input) => {
      expect(parseShortCode(input)).toBeNull();
    },
  );
});
