import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

/** Top-level blocks of the stylesheet: `{ prelude, body }`, comments removed. */
function blocks(source: string): { prelude: string; body: string }[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        // Statements such as `@import ...;` before a block are not part of its prelude.
        const prelude = text.slice(start, open);
        out.push({ prelude: prelude.slice(prelude.lastIndexOf(";") + 1).trim(), body: text.slice(open + 1, i) });
        start = i + 1;
      }
    }
  }
  return out;
}

const top = blocks(css);
const body = (prelude: string, within = top) => within.find((b) => b.prelude === prelude)?.body ?? "";
/** A rule inside any top-level block with the `media` prelude (a query can appear more than once). */
const nested = (media: string, prelude: string) =>
  top
    .filter((b) => b.prelude === media)
    .map((m) => body(prelude, blocks(m.body)))
    .find(Boolean) ?? "";
/** The value of `--muted` in a block of tokens, as the chevron's data URI writes it (%23rrggbb). */
const muted = (tokens: string) => `%23${/--muted:\s*#([0-9a-f]{6})/i.exec(tokens)![1]!.toLowerCase()}`;

describe("native selects", () => {
  // Every <select> (generator, forms, templates, list toolbar) gets the same themed control: the
  // browser's own arrow sat against the border, ignored the theme, and some were under 44px.
  const select = body("select");

  it("replace the browser arrow with a drawn chevron, clear of the border on both sides", () => {
    expect(select).toMatch(/appearance:\s*none/);
    expect(select).toMatch(/background-image:\s*url\("data:image\/svg\+xml/);
    expect(select).toMatch(/background-position:\s*right/);
    expect(select).toMatch(/padding-right:\s*2\.25rem/);
    expect(select).toMatch(/padding-left:\s*0\.75rem/);
  });

  it("stay unlayered, so a component's px-3 cannot pull the text under the chevron", () => {
    // A top-level `select` block exists only if the rule is outside every @layer.
    expect(select).not.toBe("");
    expect(top.filter((b) => b.prelude.startsWith("@layer")).some((b) => /(^|\s)select\s*\{/.test(b.body))).toBe(false);
  });

  it("are at least 44px tall (DESIGN.md touch targets) and say when they are disabled", () => {
    expect(select).toMatch(/min-height:\s*2\.75rem/);
    expect(body("select:disabled")).toMatch(/cursor:\s*not-allowed/);
  });

  it("draw the chevron in the muted ink of each theme, with the picker in the same theme", () => {
    expect(select).toContain(muted(body(":root")));
    expect(select).toMatch(/color-scheme:\s*light/);
    const dark = nested("@media (prefers-color-scheme: dark)", "select");
    expect(dark).toContain(muted(nested("@media (prefers-color-scheme: dark)", ":root")));
    expect(dark).toMatch(/color-scheme:\s*dark/);
  });

  it("give the arrow back to the system in forced colors, where a drawn chevron is not recolored", () => {
    const forced = nested("@media (forced-colors: active)", "select");
    expect(forced).toMatch(/appearance:\s*auto/);
    expect(forced).toMatch(/background-image:\s*none/);
  });
});
