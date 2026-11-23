import { describe, expect, it } from "vitest";
import { alternatesFor } from "./metadata";

describe("alternatesFor", () => {
  it("lists every locale plus x-default, canonical in the page's own locale", () => {
    expect(alternatesFor("vi", "/")).toEqual({
      canonical: "/vi",
      languages: { en: "/", vi: "/vi", es: "/es", de: "/de", fr: "/fr", pt: "/pt", "x-default": "/" },
    });
    expect(alternatesFor("en", "/wifi-qr-code")?.canonical).toBe("/wifi-qr-code");
  });
});
