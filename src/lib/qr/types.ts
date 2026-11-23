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
}

export const DEFAULT_DESIGN: QrDesign = { fg: "#000000", bg: "#ffffff", ecc: "M", margin: 4 };

export const SIZE_MIN = 128;
export const SIZE_MAX = 2048;
export const MARGIN_MAX = 16;

/** Field values of one QR type, as typed by the user. */
export type QrData = Record<string, string>;

/** A boolean field: offered as a checkbox. */
export function isToggle(field: QrField): boolean {
  return field.options?.length === 2 && field.options.includes("true") && field.options.includes("false");
}
