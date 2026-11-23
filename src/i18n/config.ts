/**
 * Locales and locale-aware paths. English lives at the root ("/login"); every other locale has a
 * prefix ("/vi/login"). Internally every route is under app/[lang]; src/proxy.ts rewrites
 * unprefixed URLs to "/en/..." and redirects "/en/..." to the unprefixed URL.
 *
 * Framework-free: used by the proxy, server components and client components alike.
 */

export const LOCALES = ["en", "vi", "es", "de", "fr", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Native names, shown in the language switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  pt: "Português",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export interface SplitPath {
  locale: Locale;
  /** The path without the locale prefix; always starts with "/". */
  rest: string;
  /** Whether the path carried a locale prefix (including "/en"). */
  explicit: boolean;
}

/** Splits "/vi/login" into ("vi", "/login"). Unprefixed paths are English. */
export function splitLocale(pathname: string): SplitPath {
  const match = /^\/([^/]+)(\/.*)?$/.exec(pathname);
  if (match && isLocale(match[1])) {
    const rest = match[2] && match[2] !== "/" ? match[2] : "/";
    return { locale: match[1], rest, explicit: true };
  }
  return { locale: DEFAULT_LOCALE, rest: pathname || "/", explicit: false };
}

/** The public URL of `path` (a site path starting with "/") in `locale`. */
export function localizePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Replaces "{name}" placeholders; unknown placeholders are left as they are. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : whole,
  );
}
