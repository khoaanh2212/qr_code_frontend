import { splitLocale } from "@/i18n/config";
import { PRIVATE_PREFIXES } from "@/lib/security/csp";

const MAX_LENGTH = 2048;
const BASE = "https://return-to.invalid";
const AUTH_PAGES = PRIVATE_PREFIXES.filter((p) => p !== "/app");

/**
 * Returns `raw` when it is a path on this site, otherwise `fallback`. Used for `return_to`
 * after login and sign-up, so it must never produce an open redirect: no scheme, no host, no
 * protocol-relative "//host", no backslashes (browsers read "/\host" as "//host"), no control
 * characters (the URL parser strips tabs and newlines, which can turn "/\t/host" into
 * "//host"). Auth pages are refused too, in every locale, so a login never loops back to itself.
 */
export function safeReturnTo(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || raw.length > MAX_LENGTH) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\") || /[\u0000-\u001f\u007f\s]/.test(raw)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  // Compare the decoded path, as the router sees it: "/%6cogin" is "/login". Encoded slashes,
  // backslashes and dot segments have no business in a return path.
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname);
  } catch {
    return fallback;
  }
  if (/[\\]|\/\.{1,2}(\/|$)|\/\//.test(decoded) || decoded !== decoded.trim()) return fallback;
  const { rest } = splitLocale(decoded);
  if (AUTH_PAGES.some((p) => rest === p || rest.startsWith(p + "/"))) return fallback;

  const out = url.pathname + url.search + url.hash;
  // Last guard: whatever happened above, never hand back a protocol-relative URL.
  return out.startsWith("/") && !out.startsWith("//") ? out : fallback;
}
