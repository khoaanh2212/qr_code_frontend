import { isScannable } from "./color";

/** Shapes of `GET /v1/qr/types` and the generator's own state. */

export interface QrField {
  name: string;
  description?: string;
  required: boolean;
  max_length?: number;
  options?: string[];
  multiline?: boolean;
}

export interface QrType {
  type: string;
  fields: QrField[];
}

export interface QrCatalog {
  types: QrType[];
  formats: string[];
}

export const ECC_LEVELS = ["L", "M", "Q", "H"] as const;
export type Ecc = (typeof ECC_LEVELS)[number];

export const FORMATS = ["png", "svg", "jpg", "pdf", "eps"] as const;
export type QrFormat = (typeof FORMATS)[number];

export interface QrLogo {
  /** Base64 of the PNG/JPEG bytes, without a data: prefix. */
  base64: string;
  name: string;
  /** Identifies this upload in cache keys, so keys never carry the bytes. */
  id: string;
}

export interface QrDesign {
  /** "#RRGGBB" */
  fg: string;
  /** "#RRGGBB" */
  bg: string;
  ecc: Ecc;
  /** Quiet zone in modules, 0-16. */
  margin: number;
  logo?: QrLogo;
  module: QrModule;
  /** Ring and center of each eye: top-left, top-right, bottom-left. */
  eyeFrames: EyeTriple<QrEyeFrame>;
  eyeBalls: EyeTriple<QrEyeBall>;
  frame: QrFrame;
  /** Caption of the frame; empty means the API's default ("SCAN ME"). */
  frameText: string;
  /** "#RRGGBB", or "" to use the foreground. */
  eyeColor: string;
  eyeBallColor: string;
  frameColor: string;
  /** A built-in icon over the center, or "" (never together with `logo`). */
  logoIcon: QrLogoIcon | "";
  /** Fill of the modules: "" is the solid `fg`; a gradient runs from `fg` to `fg2`. */
  gradient: QrGradient | "";
  /** "#RRGGBB", the gradient's end color. */
  fg2: string;
  /** Direction of a linear gradient in degrees, 0-359 (0 runs left to right, 90 top to bottom). */
  gradientAngle: number;
  /**
   * More than two colors, as a stored design may hold them (the API takes them in a design and on
   * POST only); null otherwise. Editing either color replaces them with `fg` to `fg2`.
   */
  gradientStops: GradientStop[] | null;
  /** Leaves the background unpainted; `bg` is kept for when it is turned off again. */
  transparent: boolean;
}

export const GRADIENTS = ["linear", "radial"] as const;
export type QrGradient = (typeof GRADIENTS)[number];
export const GRADIENT_ANGLE_MAX = 359;
export const GRADIENT_STOPS_MAX = 5;

export interface GradientStop {
  /** Percent of the way, 0-100, in order. */
  offset: number;
  /** "#rrggbb" */
  color: string;
}

export const LOGO_ICONS = ["scan-me", "link", "wifi", "mail", "location", "user", "star", "heart"] as const;
export type QrLogoIcon = (typeof LOGO_ICONS)[number];

export type EyeTriple<T> = readonly [T, T, T];

/** Maps each eye's value (top-left, top-right, bottom-left), keeping the triple's type. */
export function mapTriple<T, U>(t: EyeTriple<T>, f: (value: T, index: number) => U): EyeTriple<U> {
  return [f(t[0], 0), f(t[1], 1), f(t[2], 2)];
}

/** Style options of the API (backend PLAN, "Rules – QR"), in display order. */
export const MODULES = ["square", "rounded", "dots", "bars", "small", "hbars", "diamond"] as const;
export const EYE_FRAMES = ["square", "rounded", "extra-rounded", "circle", "leaf", "pointed"] as const;
export const EYE_BALLS = ["square", "rounded", "circle", "leaf", "pointed", "diamond"] as const;
export const FRAMES = [
  "none",
  "label-bottom",
  "label-top",
  "box",
  "bubble-top",
  "bubble-bottom",
  "ribbon",
  "phone",
  "bag",
  "cup",
  "arrow",
  "corners",
  "beer",
  "chef",
  "cloche",
  "takeaway",
  "menu",
  "receipt",
] as const;
/** The restaurant frames, shown as their own group (the rest of FRAMES are general). */
export const RESTAURANT_FRAMES = ["beer", "chef", "cloche", "takeaway", "menu", "receipt"] as const;
export type QrModule = (typeof MODULES)[number];
export type QrEyeFrame = (typeof EYE_FRAMES)[number];
export type QrEyeBall = (typeof EYE_BALLS)[number];

/** The API refuses this pair on one eye: scanners often miss a diamond center in a pointed ring. */
export function eyePairAllowed(frame: QrEyeFrame, ball: QrEyeBall): boolean {
  return !(frame === "pointed" && ball === "diamond");
}

/** The legacy `eye` shorthand of stored designs, as ring and center. */
export const EYE_SHORTHAND: Record<string, [QrEyeFrame, QrEyeBall]> = {
  square: ["square", "square"],
  rounded: ["rounded", "rounded"],
  circle: ["circle", "circle"],
  leaf: ["leaf", "leaf"],
};
export type QrFrame = (typeof FRAMES)[number];
export const FRAME_TEXT_MAX = 24;
/**
 * Captions anyone may use (the API's list: each language's default). Own text needs an account,
 * since public images are cached and served from our domain.
 */
export const CAPTION_PRESETS = ["SCAN ME", "QUÉT MÃ", "ESCANÉAME", "JETZT SCANNEN", "SCANNEZ-MOI", "ESCANEIE"];

/** Whether a caption is a preset (empty means the default), ignoring case and composition. */
export function isPresetCaption(text: string): boolean {
  const t = text.normalize("NFC").trim();
  if (t === "") return true;
  // Both directions, as the API does: one alone maps look-alikes ("ſ" → "S") onto a preset.
  const upper = t.toLocaleUpperCase("en");
  const lower = t.toLocaleLowerCase("en");
  return CAPTION_PRESETS.some((p) => p === upper && p.toLocaleLowerCase("en") === lower);
}
/** A frame needs this much quiet zone between its border and the code. */
export const FRAME_MARGIN_MIN = 2;

export const DEFAULT_DESIGN: QrDesign = {
  fg: "#000000",
  bg: "#ffffff",
  ecc: "M",
  margin: 4,
  module: "square",
  eyeFrames: ["square", "square", "square"],
  eyeBalls: ["square", "square", "square"],
  frame: "none",
  frameText: "",
  eyeColor: "",
  eyeBallColor: "",
  frameColor: "",
  logoIcon: "",
  gradient: "",
  fg2: "#0f766e",
  gradientAngle: 0,
  gradientStops: null,
  transparent: false,
};

type StyleParam = "logo_icon" | "module" | "eye_frame" | "eye_ball" | "eye_color" | "eye_ball_color" | "frame" | "frame_text" | "frame_color";

/** One value when all three eyes agree, else three comma-separated ones. */
function triple(values: EyeTriple<string>): string {
  return values[0] === values[1] && values[1] === values[2] ? values[0] : values.join(",");
}

/**
 * The style options that differ from the plain look, under the API's names. Defaults are left
 * out, so the URL of a plain code stays what it always was (and stays cached).
 */
export function styleParams(design: QrDesign): Partial<Record<StyleParam, string>> {
  const out: Partial<Record<StyleParam, string>> = {};
  const own = (c: string) => c !== "" && c.toLowerCase() !== design.fg.toLowerCase();
  if (design.module !== "square") out.module = design.module;
  if (design.logoIcon && !design.logo) out.logo_icon = design.logoIcon;
  if (design.eyeFrames.some((f) => f !== "square")) out.eye_frame = triple(design.eyeFrames);
  if (design.eyeBalls.some((b) => b !== "square")) out.eye_ball = triple(design.eyeBalls);
  if (own(design.eyeColor)) out.eye_color = design.eyeColor;
  if (own(design.eyeBallColor)) out.eye_ball_color = design.eyeBallColor;
  if (design.frame !== "none") {
    out.frame = design.frame;
    const text = design.frameText.trim();
    if (text) out.frame_text = text;
    if (own(design.frameColor)) out.frame_color = design.frameColor;
  }
  return out;
}

/**
 * The gradient options under the API's names (the angle is a number: send it as text in a URL).
 * Nothing for a solid fill; stops replace `fg2`; the angle only when linear and not 0.
 */
export function gradientParams(design: QrDesign): {
  gradient?: QrGradient;
  fg2?: string;
  gradient_angle?: number;
  gradient_stops?: GradientStop[];
} {
  if (!design.gradient) return {};
  const out: ReturnType<typeof gradientParams> = { gradient: design.gradient };
  if (design.gradientStops) out.gradient_stops = design.gradientStops.map((s) => ({ ...s }));
  else out.fg2 = design.fg2;
  if (design.gradient === "linear" && design.gradientAngle !== 0) out.gradient_angle = design.gradientAngle;
  return out;
}

/** The background as the API takes it: a color, or "transparent". */
export function bgParam(design: Pick<QrDesign, "bg" | "transparent">): string {
  return design.transparent ? "transparent" : design.bg;
}

/** What a transparent code is checked against: the white paper it is most likely printed on. */
const PAPER = "#ffffff";

/**
 * Whether every color of a design is a scannable dark-on-light pair with its background (white
 * paper when the background is transparent, as the API checks it).
 */
export function designScannable(design: QrDesign): boolean {
  const bg = design.transparent ? PAPER : design.bg;
  return partColors(design).every((c) => isScannable(c, bg));
}

/** Why a design cannot be downloaded in a format, or null when it can. */
export type FormatProblem = "jpgTransparent" | "epsLogo";

/** JPEG has no transparency; EPS cannot carry an uploaded logo (built-in icons are outlines). */
export function formatProblem(design: Pick<QrDesign, "transparent"> & Partial<QrDesign>, format: QrFormat): FormatProblem | null {
  if (format === "jpg" && design.transparent) return "jpgTransparent";
  if (format === "eps" && design.logo) return "epsLogo";
  return null;
}

/** The colors a design paints with besides the background: each must keep the contrast. */
export function partColors(design: QrDesign): string[] {
  // With stops, fg still paints what they do not cover (eyes without a color of their own).
  const out = design.gradientStops && design.gradient ? [design.fg, ...design.gradientStops.map((s) => s.color)] : [design.fg];
  if (design.gradient && !design.gradientStops) out.push(design.fg2);
  if (design.eyeColor) out.push(design.eyeColor);
  if (design.eyeBallColor) out.push(design.eyeBallColor);
  if (design.frameColor && design.frame !== "none") out.push(design.frameColor);
  return out;
}

export const SIZE_MIN = 128;
export const SIZE_MAX = 2048;
export const MARGIN_MAX = 16;

/** Field values of one QR type, as typed by the user. */
export type QrData = Record<string, string>;

/** A boolean field: offered as a checkbox. */
export function isToggle(field: QrField): boolean {
  return field.options?.length === 2 && field.options.includes("true") && field.options.includes("false");
}
