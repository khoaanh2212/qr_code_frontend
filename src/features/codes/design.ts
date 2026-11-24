import type { CodeDesign } from "@/lib/api/types";
import { normalizeHex } from "@/lib/qr/color";
import {
  DEFAULT_DESIGN,
  designScannable,
  EYE_BALLS,
  EYE_FRAMES,
  EYE_SHORTHAND,
  eyePairAllowed,
  FRAME_MARGIN_MIN,
  FRAME_TEXT_MAX,
  FRAMES,
  LOGO_ICONS,
  MODULES,
  styleParams,
  type EyeTriple,
  type QrDesign,
} from "@/lib/qr/types";

/** What the code pages edit of a design: colors and style (the API keeps its own margin). */
export type CodeLook = Pick<
  QrDesign,
  | "fg"
  | "bg"
  | "module"
  | "eyeFrames"
  | "eyeBalls"
  | "eyeColor"
  | "eyeBallColor"
  | "frame"
  | "frameText"
  | "frameColor"
  | "logoIcon"
  | "margin"
>;

const pick = <V extends string>(values: readonly V[], v: unknown, fallback: V): V =>
  values.includes(v as V) ? (v as V) : fallback;

export const DEFAULT_LOOK: CodeLook = {
  fg: DEFAULT_DESIGN.fg,
  bg: DEFAULT_DESIGN.bg,
  module: DEFAULT_DESIGN.module,
  eyeFrames: DEFAULT_DESIGN.eyeFrames,
  eyeBalls: DEFAULT_DESIGN.eyeBalls,
  eyeColor: "",
  eyeBallColor: "",
  frame: DEFAULT_DESIGN.frame,
  frameText: "",
  frameColor: "",
  logoIcon: "",
  margin: DEFAULT_DESIGN.margin,
};

/** "a" or "a,b,c" (the API's form) as three values, each one allowed, else the fallback. */
function triple<V extends string>(values: readonly V[], v: unknown, fallback: V): EyeTriple<V> {
  const parts = typeof v === "string" ? v.split(",").map((x) => x.trim()) : [];
  const at = (i: number) => pick(values, parts.length === 3 ? parts[i] : parts[0], fallback);
  return [at(0), at(1), at(2)];
}

const color = (v: unknown): string => (typeof v === "string" ? (normalizeHex(v) ?? "") : "");

/** Whether every color of a look is a scannable dark-on-light pair with its background. */
export function lookScannable(look: CodeLook): boolean {
  return designScannable({ ...DEFAULT_DESIGN, ...look });
}

/** A stored design as the form edits it; unknown values fall back to the defaults. */
export function lookFromDesign(d: CodeDesign): CodeLook {
  // Designs saved before eye parts existed name both with `eye`.
  const [legacyFrame, legacyBall] =
    d.eye && Object.hasOwn(EYE_SHORTHAND, d.eye) ? EYE_SHORTHAND[d.eye] : (["square", "square"] as const);
  const eyeFrames = triple(EYE_FRAMES, d.eye_frame ?? legacyFrame, "square");
  // A pair the API refuses (saved before the rule) loads with a square center.
  const eyeBalls = triple(EYE_BALLS, d.eye_ball ?? legacyBall, "square").map((b, i) =>
    eyePairAllowed(eyeFrames[i], b) ? b : "square",
  ) as unknown as EyeTriple<QrDesign["eyeBalls"][number]>;
  return {
    fg: d.fg ?? DEFAULT_LOOK.fg,
    bg: d.bg ?? DEFAULT_LOOK.bg,
    module: pick(MODULES, d.module, DEFAULT_LOOK.module),
    eyeFrames,
    eyeBalls,
    eyeColor: color(d.eye_color),
    eyeBallColor: color(d.eye_ball_color),
    frame: pick(FRAMES, d.frame, DEFAULT_LOOK.frame),
    frameText: typeof d.frame_text === "string" ? d.frame_text : "",
    frameColor: color(d.frame_color),
    logoIcon: pick(LOGO_ICONS, d.logo_icon, "" as const),
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

/** Validates hand-off values without trusting them. */
export function safeLook(v: Partial<Record<keyof CodeLook, unknown>>): Partial<CodeLook> {
  const out: Partial<CodeLook> = {};
  if (MODULES.includes(v.module as never)) out.module = v.module as CodeLook["module"];
  if (Array.isArray(v.eyeFrames) && v.eyeFrames.length === 3 && Array.isArray(v.eyeBalls) && v.eyeBalls.length === 3) {
    const frames = triple(EYE_FRAMES, v.eyeFrames.join(","), "square");
    const balls = triple(EYE_BALLS, v.eyeBalls.join(","), "square");
    if (frames.every((f, i) => eyePairAllowed(f, balls[i]))) {
      out.eyeFrames = frames;
      out.eyeBalls = balls;
    }
  }
  if (FRAMES.includes(v.frame as never)) out.frame = v.frame as CodeLook["frame"];
  if (typeof v.frameText === "string") out.frameText = v.frameText.slice(0, FRAME_TEXT_MAX);
  if (LOGO_ICONS.includes(v.logoIcon as never)) out.logoIcon = v.logoIcon as CodeLook["logoIcon"];
  for (const key of ["eyeColor", "eyeBallColor", "frameColor"] as const) {
    const c = color(v[key]);
    if (c) out[key] = c;
  }
  return out;
}
