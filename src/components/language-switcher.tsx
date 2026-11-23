"use client";

import { ChevronDown, Languages } from "lucide-react";
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
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-2 hover:bg-foreground/5">
        <span className="sr-only">{label}: </span>
        <Languages aria-hidden="true" className="size-4" />
        {/* Phones show the language code, wider screens its name. */}
        <span aria-hidden="true" className="font-mono text-xs uppercase sm:hidden">
          {locale}
        </span>
        <span className="sr-only sm:not-sr-only">{LOCALE_NAMES[locale]}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted" />
      </summary>
      <nav aria-label={label} className="absolute right-0 z-30 mt-1 min-w-44 rounded-md border border-border bg-surface py-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)]">
        <ul>
          {LOCALES.map((l) => (
            <li key={l}>
              <a
                href={localizePath(l, "/")}
                hrefLang={l}
                lang={l}
                aria-current={l === locale ? "true" : undefined}
                className="flex min-h-11 items-center px-3 hover:bg-foreground/5 aria-[current]:font-semibold"
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
