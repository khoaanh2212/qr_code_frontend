/** "#rrggbb" in lower case, or null when `value` is not a 6-digit hex color. */
export function normalizeHex(value: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two "#rrggbb" colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Whether scanners can read the code: a dark foreground on a light background with a contrast
 * of at least 3:1. The API applies the same rule; checking here gives instant feedback.
 */
export function isScannable(fg: string, bg: string): boolean {
  return luminance(fg) < luminance(bg) && contrastRatio(fg, bg) >= 3;
}
