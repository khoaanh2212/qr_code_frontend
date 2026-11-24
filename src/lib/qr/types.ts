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

export type QrFormat = "png" | "svg";

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
  eye: QrEye;
  frame: QrFrame;
  /** Caption of the frame; empty means the API's default ("SCAN ME"). */
  frameText: string;
}

/** Style options of the API (backend PLAN, "Rules – QR"), in display order. */
export const MODULES = ["square", "rounded", "dots", "bars"] as const;
export const EYES = ["square", "rounded", "circle", "leaf"] as const;
export const FRAMES = ["none", "label-bottom", "label-top", "box"] as const;
export type QrModule = (typeof MODULES)[number];
export type QrEye = (typeof EYES)[number];
export type QrFrame = (typeof FRAMES)[number];
export const FRAME_TEXT_MAX = 24;
/** A frame needs this much quiet zone between its border and the code. */
export const FRAME_MARGIN_MIN = 2;

export const DEFAULT_DESIGN: QrDesign = {
  fg: "#000000",
  bg: "#ffffff",
  ecc: "M",
  margin: 4,
  module: "square",
  eye: "square",
  frame: "none",
  frameText: "",
};

/**
 * The style options that differ from the plain look, under the API's names. Defaults are left
 * out, so the URL of a plain code stays what it always was (and stays cached).
 */
export function styleParams(design: QrDesign): Partial<Record<"module" | "eye" | "frame" | "frame_text", string>> {
  const out: Partial<Record<"module" | "eye" | "frame" | "frame_text", string>> = {};
  if (design.module !== "square") out.module = design.module;
  if (design.eye !== "square") out.eye = design.eye;
  if (design.frame !== "none") {
    out.frame = design.frame;
    const text = design.frameText.trim();
    if (text) out.frame_text = text;
  }
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
