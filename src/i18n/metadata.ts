import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, localizePath, type Locale } from "./config";

/**
 * Canonical URL and hreflang alternates of a public page (`path` without locale prefix).
 * English is also the x-default.
 */
export function alternatesFor(locale: Locale, path: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = localizePath(l, path);
  languages["x-default"] = localizePath(DEFAULT_LOCALE, path);
  return { canonical: localizePath(locale, path), languages };
}
