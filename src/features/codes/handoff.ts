/**
 * Hand-off from the public generator to "New dynamic code": the destination and look travel in
 * sessionStorage (this tab only, never in a URL), so a sign-up or login in between loses nothing.
 * The form reads it while rendering (pure, so safe to call twice) and clears it once mounted.
 */

import { safeLook, type CodeLook } from "./design";

const KEY = "proofqr:dynamic-handoff";

export interface Handoff {
  url: string;
  fg?: string;
  bg?: string;
  /** Pattern, eyes and frame of the generator's design. */
  style?: Partial<Omit<CodeLook, "fg" | "bg" | "margin">>;
}

export function saveHandoff(h: Handoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    // Storage blocked: the new-code form simply starts empty.
  }
}

export function clearHandoff(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was saved either.
  }
}

export function readHandoff(): Handoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || typeof (v as Handoff).url !== "string") return null;
    const { url, fg, bg, style } = v as Handoff;
    const hex = (c: unknown) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
    const look = style && typeof style === "object" ? safeLook(style) : {};
    return { url: url.slice(0, 2048), fg: hex(fg), bg: hex(bg), style: look };
  } catch {
    return null;
  }
}
