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

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((b, i) => bytes[i] === b);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Reads a PNG or JPEG chosen by the user, checked by its bytes (never by name or type). */
export async function readLogo(file: File): Promise<QrLogo> {
  if (file.size > LOGO_MAX_BYTES) throw new LogoError("size");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!startsWith(bytes, PNG) && !startsWith(bytes, JPEG)) throw new LogoError("type");
  return { name: file.name, base64: toBase64(bytes), id: `${Date.now()}-${bytes.length}-${Math.random().toString(36).slice(2)}` };
}
