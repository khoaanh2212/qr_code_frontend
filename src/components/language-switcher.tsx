"use client";

import { LOCALE_NAMES, LOCALES, localizePath, splitLocale, type Locale } from "@/i18n/config";
import { safeReturnTo } from "@/lib/navigation/return-to";

/**
 * The same page in another language. A `return_to` path in the query follows the switch, so
 * logging in after switching lands in the chosen language; an unsafe `return_to` is dropped.
 */
export function switchLocaleUrl(target: Locale, pathname: string, search: string, hash = ""): string {
  const params = new URLSearchParams(search);
  const raw = params.get("return_to");
  if (raw !== null) {
    const safe = safeReturnTo(raw, "");
    if (safe) {
      // Localize only the path; the query and fragment of the target stay as they are.
      const url = new URL(safe, "https://switch.invalid");
      params.set("return_to", localizePath(target, splitLocale(url.pathname).rest) + url.search + url.hash);
    } else {
      params.delete("return_to");
    }
  }
  let { rest } = splitLocale(pathname);
  if (rest.startsWith("//")) rest = "/";
  const query = params.toString();
  return localizePath(target, rest) + (query ? `?${query}` : "") + hash;
}

/**
 * Language menu: real links (no navigation on arrow keys, works for keyboards and screen
 * readers). The hrefs point at each language's home page; with JavaScript the click keeps the
 * current page and query instead.
 */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  return (
    <details className="relative text-sm">
      <summary className="cursor-pointer list-none rounded border border-black/20 px-2 py-1 dark:border-white/20">
        <span className="sr-only">{label}: </span>
        {LOCALE_NAMES[locale]}
      </summary>
      <nav aria-label={label} className="absolute right-0 z-10 mt-1 min-w-40 rounded border border-black/10 bg-background py-1 shadow dark:border-white/10">
        <ul>
          {LOCALES.map((l) => (
            <li key={l}>
              <a
                href={localizePath(l, "/")}
                hrefLang={l}
                lang={l}
                aria-current={l === locale ? "true" : undefined}
                className="block px-3 py-1 hover:bg-black/5 aria-[current]:font-semibold dark:hover:bg-white/10"
                onClick={(e) => {
                  e.preventDefault();
                  const { pathname, search, hash } = window.location;
                  window.location.assign(switchLocaleUrl(l, pathname, search, hash));
                }}
              >
                {LOCALE_NAMES[l]}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
