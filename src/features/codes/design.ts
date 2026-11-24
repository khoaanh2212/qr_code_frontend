import type { CodeDesign } from "@/lib/api/types";
import { DEFAULT_DESIGN, EYES, FRAME_MARGIN_MIN, FRAME_TEXT_MAX, FRAMES, MODULES, styleParams, type QrDesign } from "@/lib/qr/types";

/** What the code pages edit of a design: colors and style (the API keeps its own margin). */
export type CodeLook = Pick<QrDesign, "fg" | "bg" | "module" | "eye" | "frame" | "frameText" | "margin">;

const pick = <V extends string>(values: readonly V[], v: unknown, fallback: V): V =>
  values.includes(v as V) ? (v as V) : fallback;

export const DEFAULT_LOOK: CodeLook = {
  fg: DEFAULT_DESIGN.fg,
  bg: DEFAULT_DESIGN.bg,
  module: DEFAULT_DESIGN.module,
  eye: DEFAULT_DESIGN.eye,
  frame: DEFAULT_DESIGN.frame,
  frameText: "",
  margin: DEFAULT_DESIGN.margin,
};

/** A stored design as the form edits it; unknown values fall back to the defaults. */
export function lookFromDesign(d: CodeDesign): CodeLook {
  return {
    fg: d.fg ?? DEFAULT_LOOK.fg,
    bg: d.bg ?? DEFAULT_LOOK.bg,
    module: pick(MODULES, d.module, DEFAULT_LOOK.module),
    eye: pick(EYES, d.eye, DEFAULT_LOOK.eye),
    frame: pick(FRAMES, d.frame, DEFAULT_LOOK.frame),
    frameText: typeof d.frame_text === "string" ? d.frame_text : "",
    margin: d.margin ?? DEFAULT_LOOK.margin,
  };
}

/** The design the API stores; the stored ecc and margin are kept as they were. */
export function designFromLook(look: CodeLook, keep: CodeDesign = {}): CodeDesign {
  const out: CodeDesign = { fg: look.fg, bg: look.bg, ...styleParams({ ...DEFAULT_DESIGN, ...look }) };
  if (keep.ecc) out.ecc = keep.ecc;
  if (keep.margin !== undefined) out.margin = look.frame === "none" ? keep.margin : Math.max(keep.margin, FRAME_MARGIN_MIN);
  return out;
}

/** Validates hand-off or stored values without trusting them. */
export function safeLook(v: Partial<Record<keyof CodeLook, unknown>>): Partial<CodeLook> {
  const out: Partial<CodeLook> = {};
  if (MODULES.includes(v.module as never)) out.module = v.module as CodeLook["module"];
  if (EYES.includes(v.eye as never)) out.eye = v.eye as CodeLook["eye"];
  if (FRAMES.includes(v.frame as never)) out.frame = v.frame as CodeLook["frame"];
  if (typeof v.frameText === "string") out.frameText = v.frameText.slice(0, FRAME_TEXT_MAX);
  return out;
}
