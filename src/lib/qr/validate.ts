import { validEmail } from "@/lib/forms/email";
import type { QrData, QrType } from "./types";

/**
 * Client-side copies of the API's rules (internal/qr/encoders.go in the backend), so the
 * generator can say exactly what is wrong before calling the API. The API stays the authority.
 */
export type FieldProblem = "url" | "email" | "phone" | "ssidBytes" | "wpa";

const URL_FIELDS = new Set(["url", "website"]);
const EMAIL_FIELDS = new Set(["email", "to"]);
const PHONE_FIELDS = new Set(["phone"]);

const PHONE = /^\+?[0-9]{3,15}$/;
const HEX64 = /^[0-9a-fA-F]{64}$/;

const bytes = (s: string) => new TextEncoder().encode(s).length;

function validWebUrl(value: string): boolean {
  // Go's url.Parse finds no host in "http:///x" (JS's URL does), and refuses control characters.
  if (!/^https?:\/\/[^/?#\s]/i.test(value) || /\p{C}/u.test(value)) return false;
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname !== "";
  } catch {
    return false;
  }
}

/** Problems of filled-in fields (empty required fields are `missingRequired`'s job). */
export function validateFields(type: QrType, data: QrData): Record<string, FieldProblem> {
  const problems: Record<string, FieldProblem> = {};
  for (const { name } of type.fields) {
    const raw = data[name] ?? "";
    // The API trims every field except ssid, password and phone.
    const value = PHONE_FIELDS.has(name) ? raw : raw.trim();
    if (raw.trim() === "") continue;
    if (URL_FIELDS.has(name) && !validWebUrl(value)) problems[name] = "url";
    else if (EMAIL_FIELDS.has(name) && !validEmail(value)) problems[name] = "email";
    else if (PHONE_FIELDS.has(name) && (value.startsWith(" ") || !PHONE.test(value.replace(/[ \-().]/g, ""))))
      problems[name] = "phone";
  }
  // An empty WPA/WEP password is `missingRequired`'s case; an open network's password is never
  // sent (buildRenderRequest drops it).
  if (type.type === "wifi") {
    if (bytes(data.ssid ?? "") > 32) problems.ssid = "ssidBytes";
    const password = data.password ?? "";
    const len = bytes(password);
    if ((data.encryption ?? "WPA") === "WPA" && password !== "" && !HEX64.test(password) && (len < 8 || len > 63)) {
      problems.password = "wpa";
    }
  }
  return problems;
}

/** "example.com" becomes "https://example.com"; anything with a scheme or a space is left alone. */
export function normalizeUrlInput(value: string): string {
  const v = value.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v); // "host:8080" is a port, not a scheme
  const hasUserinfo = /^[^/]*@/.test(v); // "user@example.com" must not become a URL with userinfo
  if (v === "" || hasScheme || hasUserinfo || /\s/.test(v) || !v.includes(".")) return v;
  return `https://${v}`;
}

function slug(text: string, words = 6): string {
  return text
    .replace(/[đĐ]/g, "d")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, words)
    .join("-")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** A file name that says what the code contains ("qr-example-com"), never personal details beyond what the user typed. */
export function downloadName(type: string, data: QrData): string {
  let part = "";
  switch (type) {
    case "url":
      try {
        part = slug(new URL(data.url ?? "").hostname.replace(/^www\./, ""));
      } catch {
        part = "";
      }
      break;
    case "wifi":
      part = slug(data.ssid ?? "") && `wifi-${slug(data.ssid ?? "")}`;
      break;
    case "vcard":
      part = slug([data.first_name, data.last_name].filter(Boolean).join(" ")) || slug(data.organization ?? "");
      break;
    case "email":
      part = slug((data.to ?? "").split("@")[0]) && `email-${slug((data.to ?? "").split("@")[0])}`;
      break;
    case "sms":
    case "phone": {
      const digits = (data.phone ?? "").replace(/\D/g, "");
      part = digits && `tel-${digits}`;
      break;
    }
    case "text":
      part = slug(data.text ?? "", 3);
      break;
  }
  return part ? `qr-${part}` : `qr-code-${type}`;
}
