import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, format, isLocale, localizePath, splitLocale } from "./config";

describe("locales", () => {
  it("English is the default and listed first", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES[0]).toBe("en");
    expect([...LOCALES].sort()).toEqual(["de", "en", "es", "fr", "pt", "vi"]);
  });

  it.each(["en", "vi", "pt"])("%s is a locale", (l) => expect(isLocale(l)).toBe(true));
  it.each(["", "EN", "vn", "en-US", "app", "__proto__", "constructor"])("%j is not a locale", (l) =>
    expect(isLocale(l)).toBe(false),
  );
});

describe("splitLocale", () => {
  it.each([
    ["/", { locale: "en", rest: "/", explicit: false }],
    ["/login", { locale: "en", rest: "/login", explicit: false }],
    ["/app/codes/1", { locale: "en", rest: "/app/codes/1", explicit: false }],
    ["/vi", { locale: "vi", rest: "/", explicit: true }],
    ["/vi/", { locale: "vi", rest: "/", explicit: true }],
    ["/vi/login", { locale: "vi", rest: "/login", explicit: true }],
    ["/en", { locale: "en", rest: "/", explicit: true }],
    ["/en/app", { locale: "en", rest: "/app", explicit: true }],
    ["/video", { locale: "en", rest: "/video", explicit: false }],
    ["/vi-login", { locale: "en", rest: "/vi-login", explicit: false }],
    ["/VI/login", { locale: "en", rest: "/VI/login", explicit: false }],
  ])("%s", (path, want) => {
    expect(splitLocale(path)).toEqual(want);
  });
});

describe("localizePath", () => {
  it.each([
    ["en", "/", "/"],
    ["en", "/login", "/login"],
    ["vi", "/", "/vi"],
    ["vi", "/login", "/vi/login"],
    ["de", "/app/codes?x=1", "/de/app/codes?x=1"],
  ] as const)("%s %s -> %s", (locale, path, want) => {
    expect(localizePath(locale, path)).toBe(want);
  });
});

describe("format", () => {
  it("fills named placeholders and leaves unknown ones", () => {
    expect(format("Hi {name}, {n} codes {missing}", { name: "An", n: 3 })).toBe("Hi An, 3 codes {missing}");
  });
});
