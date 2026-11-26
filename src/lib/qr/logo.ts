import type { QrLogo } from "./types";

/** The API's limit (it also requires 16-1024 px per side, checked on the server). */
export const LOGO_MAX_BYTES = 1 << 20;

export class LogoError extends Error {
  constructor(readonly reason: "type" | "size") {
    super(`logo rejected: ${reason}`);
    this.name = "LogoError";
  }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
const GIF89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

/**
 * Whether the bytes start like an SVG document (after a byte order mark,
 * white space, an XML declaration and comments), as the API checks it.
 */
export function looksLikeSvg(bytes: Uint8Array): boolean {
  let head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 4096)).replace(/^\ufeff/, "");
  for (;;) {
    head = head.trimStart();
    if (head.startsWith("<?xml") || head.startsWith("<!--")) {
      const end = head.indexOf(">");
      if (end < 0) return false;
      head = head.slice(end + 1);
      continue;
    }
    return head.startsWith("<svg");
  }
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

/** Base64 of bytes, in chunks (spreading a large array overflows the stack). */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Reads a PNG, JPEG, GIF or SVG chosen by the user, checked by its bytes (never by name or type).
 * The API draws an SVG into pixels and checks it further.
 */
export async function readLogo(file: File): Promise<QrLogo> {
  if (file.size > LOGO_MAX_BYTES) throw new LogoError("size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (![PNG, JPEG, GIF87, GIF89].some((m) => startsWith(bytes, m)) && !looksLikeSvg(bytes)) throw new LogoError("type");
  return { name: file.name, base64: toBase64(bytes), id: `${Date.now()}-${bytes.length}-${Math.random().toString(36).slice(2)}` };
}
