import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { TYPE_PAGES } from "@/lib/qr/type-pages";

vi.mock("@/i18n/server", () => ({
  getLocale: async () => "de",
  getMessages: async () => en,
}));

const { typePageMetadata } = await import("./type-page");

const MARKETING = join(process.cwd(), "src/app/[lang]/(marketing)");

describe("per-type routes", () => {
  // Static folders rather than a [slug] segment: an unknown slug then matches no route and gets
  // a real 404 (a [slug] page calling notFound() answers 200 under Cache Components).
  it.each(TYPE_PAGES)("$slug has its own route that renders type $type", ({ slug, type }) => {
    const file = join(MARKETING, slug, "page.tsx");
    expect(existsSync(file), file).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source).toContain(`typePageMetadata("${type}")`);
    expect(source).toContain(`<TypePage type="${type}" />`);
  });

  it("has no catch-all segment that would answer unknown paths", () => {
    expect(readdirSync(MARKETING).filter((d) => d.startsWith("["))).toEqual([]);
  });
});

describe("typePageMetadata", () => {
  it("gives each page its own title, description, canonical and alternates", async () => {
    const meta = await typePageMetadata("wifi");
    expect(meta.title).toEqual({ absolute: `${en.typePages.pages.wifi.title} | ProofQR` });
    expect(meta.description).toBe(en.typePages.pages.wifi.description);
    expect(meta.alternates?.canonical).toBe("/de/wifi-qr-code");
    expect(meta.alternates?.languages).toMatchObject({ en: "/wifi-qr-code", "x-default": "/wifi-qr-code" });
    // Left to the segment's opengraph-image file; a page-level object would drop the image.
    expect(meta.openGraph).toBeUndefined();
  });
});
