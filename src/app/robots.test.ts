import { describe, expect, it } from "vitest";
import { LOCALES, localizePath } from "@/i18n/config";
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
  it("lists the home page in every language with alternates", () => {
    const entries = sitemap();
    const urls = entries.map((e) => new URL(e.url).pathname);
    expect(urls.sort()).toEqual(["/", "/de", "/es", "/fr", "/pt", "/vi"]);
    for (const e of entries) {
      expect(Object.keys(e.alternates?.languages ?? {}).sort()).toEqual([...LOCALES].sort());
    }
  });

  it("never lists a private page", () => {
    for (const e of sitemap()) {
      const path = new URL(e.url).pathname;
      expect(PRIVATE_PREFIXES.some((p) => path.endsWith(p))).toBe(false);
    }
  });
});
