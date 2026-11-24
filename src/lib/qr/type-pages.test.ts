import { describe, expect, it } from "vitest";
import { TYPE_PAGES, typePageForSlug, typePagePath } from "./type-pages";

describe("type pages", () => {
  it("gives every QR type exactly one slug", () => {
    const types = TYPE_PAGES.map((p) => p.type);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(["email", "phone", "sms", "text", "url", "vcard", "wifi"]);
    expect(new Set(TYPE_PAGES.map((p) => p.slug)).size).toBe(TYPE_PAGES.length);
  });

  it("resolves known slugs and nothing else", () => {
    expect(typePageForSlug("wifi-qr-code")?.type).toBe("wifi");
    expect(typePageForSlug("vcard-qr-code")?.type).toBe("vcard");
    for (const slug of ["wifi", "WIFI-qr-code", "login", "app", "", "constructor", "__proto__", "toString"]) {
      expect(typePageForSlug(slug), slug).toBeUndefined();
    }
  });

  it("builds the unprefixed path of a type's page", () => {
    expect(typePagePath("url")).toBe("/url-qr-code");
    expect(typePagePath("phone")).toBe("/phone-qr-code");
  });
});
