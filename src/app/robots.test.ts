import { describe, expect, it } from "vitest";
import { LOCALES, localizePath } from "@/i18n/config";
import { TYPE_PAGES } from "@/lib/qr/type-pages";
import { PRIVATE_PREFIXES } from "@/lib/security/csp";
import robots from "./robots";
import sitemap from "./sitemap";

describe("robots.txt", () => {
  const rules = robots().rules;
  const disallow = new Set([rules].flat()[0]?.disallow ?? []);

  it("blocks every private page in every language, by whole segment", () => {
    for (const locale of LOCALES) {
      for (const prefix of PRIVATE_PREFIXES) {
        const path = localizePath(locale, prefix);
        expect(disallow.has(`${path}$`), path).toBe(true);
        expect(disallow.has(`${path}/`), path).toBe(true);
      }
    }
    expect(disallow.has("/app")).toBe(false);
  });
});

describe("sitemap", () => {
  it("lists the home page and every per-type page in every language with alternates", () => {
    const entries = sitemap();
    const urls = entries.map((e) => new URL(e.url).pathname).sort();
    const paths = ["/", ...TYPE_PAGES.map((p) => `/${p.slug}`)];
    expect(urls).toEqual(LOCALES.flatMap((l) => paths.map((p) => localizePath(l, p))).sort());
    expect(urls).toContain("/vi/wifi-qr-code");
    for (const e of entries) {
      const languages = e.alternates?.languages ?? {};
      expect(Object.keys(languages).sort()).toEqual([...LOCALES, "x-default"].sort());
      expect(new URL(languages["x-default" as keyof typeof languages] as string).pathname).toBe(
        new URL(languages.en as string).pathname,
      );
    }
  });

  it("never lists a private page", () => {
    for (const e of sitemap()) {
      const path = new URL(e.url).pathname;
      expect(PRIVATE_PREFIXES.some((p) => path.endsWith(p))).toBe(false);
    }
  });
});
