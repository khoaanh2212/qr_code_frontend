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

  it("draw the chevron in the muted ink, with a light picker", () => {
    expect(select).toContain(muted(body(":root")));
    expect(select).toMatch(/color-scheme:\s*light/);
  });

  it("give the arrow back to the system in forced colors, where a drawn chevron is not recolored", () => {
    const forced = nested("@media (forced-colors: active)", "select");
    expect(forced).toMatch(/appearance:\s*auto/);
    expect(forced).toMatch(/background-image:\s*none/);
  });
});

describe("styled select pickers", () => {
  // Where the browser lets CSS style a select's picker (appearance: base-select), the list it opens
  // follows the design system too; elsewhere the native picker above stays. No script, no library:
  // the control is still a <select>, with its keyboard and screen reader behaviour.
  const supports = "@supports (appearance: base-select)";
  const rule = (prelude: string) => nested(supports, prelude);

  it("opt the select and its picker into base-select only where it is supported", () => {
    expect(rule("select,\n  ::picker(select)") || rule("select, ::picker(select)")).toMatch(/appearance:\s*base-select/);
    // The drawn chevron gives way to the picker icon, which turns when the list is open.
    expect(rule("select")).toMatch(/background-image:\s*none/);
    expect(rule("select::picker-icon")).toMatch(/mask/);
    expect(rule("select:open::picker-icon")).toMatch(/rotate:\s*180deg/);
  });

  it("draw the list as a themed popover: surface, border, rounded, with depth", () => {
    const picker = rule("::picker(select)");
    expect(picker).toMatch(/background(-color)?:\s*var\(--surface\)/);
    expect(picker).toMatch(/border:\s*1px solid var\(--border\)/);
    expect(picker).toMatch(/border-radius/);
    expect(picker).toMatch(/box-shadow/);
    expect(picker).toMatch(/max-height/);
  });

  it("give options 44px targets, a soft accent under the pointer, and mark the chosen one", () => {
    expect(rule("option")).toMatch(/min-height:\s*2\.75rem/);
    expect(rule("option:hover")).toMatch(/var\(--accent-soft\)/);
    expect(rule("option:checked")).toMatch(/var\(--accent\)/);
    // The check is decoration: empty alternative text, so screen readers do not read it out.
    expect(rule("option::checkmark")).toMatch(/content:\s*"✓"\s*\/\s*""/);
  });

  it("show keyboard focus with a real outline, apart from hover (WCAG 2.4.7, 1.4.11)", () => {
    const focus = rule("option:focus-visible");
    expect(focus).toMatch(/outline:\s*2px solid var\(--accent\)/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/option[^{]*\{[^}]*outline:\s*none/);
    // Forced colors drop backgrounds: focus is an outline in the system's colors there.
    expect(nested("@media (forced-colors: active)", "option:focus-visible")).toMatch(/outline:\s*2px solid/);
  });

  it("stay inline and size the picker to its field, within the screen", () => {
    expect(rule("select")).toMatch(/display:\s*inline-flex/);
    const picker = rule("::picker(select)");
    expect(picker).toMatch(/min-width:\s*anchor-size\(width\)/);
    expect(picker).toMatch(/max-width/);
  });

  it("animate only with motion allowed, open and close alike, never everything", () => {
    const block = top.find((b) => b.prelude === supports)?.body ?? "";
    expect(block).not.toMatch(/transition:\s*all/);
    const motion = blocks(block).find((b) => b.prelude === "@media (prefers-reduced-motion: no-preference)")?.body ?? "";
    // Closed state, open state and the entry frame all live under the media query.
    expect(body("::picker(select)", blocks(motion))).toMatch(/opacity:\s*0/);
    expect(body("select:open::picker(select)", blocks(motion))).toMatch(/opacity:\s*1/);
    expect(motion).toMatch(/@starting-style/);
    // Outside it, nothing moves.
    const outside = blocks(block).filter((b) => !b.prelude.startsWith("@media")).map((b) => b.body).join("\n");
    expect(outside).not.toMatch(/transition/);
  });
});

describe("theme", () => {
  // The app is light only (decided 2026-11-27): following the system's dark mode made it too dark.
  it("has no dark theme and tells the browser so", () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
    expect(body(":root")).toMatch(/color-scheme:\s*light/);
  });

  it("keeps a light background, dark ink and readable muted ink", () => {
    const root = body(":root");
    const hex = (name: string) => {
      const m = new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, "i").exec(root);
      if (!m) throw new Error(`token --${name} is missing from :root`);
      return m[1]!;
    };
    const lum = (h: string) => {
      const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [lum(hex(a)), lum(hex(b))].sort((x, y) => y - x);
      return (hi! + 0.05) / (lo! + 0.05);
    };
    expect(lum(hex("background"))).toBeGreaterThan(0.9);
    expect(lum(hex("surface"))).toBeGreaterThan(0.9);
    expect(contrast("foreground", "background")).toBeGreaterThan(12);
    expect(contrast("muted", "background")).toBeGreaterThan(4.5);
    expect(contrast("accent", "surface")).toBeGreaterThan(4.5);
  });
});
