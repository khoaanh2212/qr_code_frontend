import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const css = read("./globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

// The site header stays on top while the page scrolls (as on the reference product), in every shell;
// what was sticky below it now sits under it instead of sliding beneath.
describe("sticky header", () => {
  const shells = {
    marketing: "../app/[lang]/(marketing)/layout.tsx",
    auth: "../app/[lang]/(private)/(auth)/layout.tsx",
    app: "../features/app-shell/app-frame.tsx",
  };

  it.each(Object.entries(shells))("pins the %s header to the top, above the content", (_, path) => {
    const header = /<header className="([^"]+)"/.exec(read(path))?.[1] ?? "";
    for (const cls of ["sticky", "top-0", "z-30", "bg-header"]) expect(header.split(/\s+/)).toContain(cls);
  });

  it("names the header's height once, and keeps anchors clear of it", () => {
    expect(css).toMatch(/--header-h:\s*[\d.]+rem/);
    expect(css).toMatch(/html\s*\{[^}]*scroll-padding-top:\s*var\(--header-h\)/);
  });

  it.each([
    ["generator preview", "../features/qr-editor/qr-editor.tsx"],
    ["design preview", "../features/codes/design-preview.tsx"],
    ["folder column", "../features/codes/list/codes-list.tsx"],
  ])("puts the %s under the header", (_, path) => {
    const source = read(path);
    expect(source).toMatch(/top-\[(calc\()?var\(--header-h\)/);
    expect(source).not.toMatch(/\b(lg:)?sticky\b[^"]*\b(lg:)?top-(0|6)\b/);
  });

  it("opens content menus above the header, not under it", () => {
    const menu = read("../components/ui/menu.tsx");
    expect(menu).toMatch(/role="menu"[\s\S]*?absolute top-full z-40/);
  });

  it("keeps the marketing header on one line at phone width", () => {
    const nav = read("../app/[lang]/(marketing)/layout.tsx");
    expect(nav).toMatch(/shrink-0[^"]*whitespace-nowrap/);
    expect(read("../components/brand/logo.tsx")).toMatch(/max-sm:sr-only">\{SITE_NAME\}/);
  });
});
