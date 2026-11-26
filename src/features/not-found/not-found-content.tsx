"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/logo";
import { DEFAULT_LOCALE, localizePath, splitLocale, type Locale } from "@/i18n/config";
import { NOT_FOUND_MESSAGES, type NotFoundMessages } from "@/i18n/not-found";

const navLink = "inline-flex min-h-11 items-center px-1 underline-offset-4 hover:underline";

/** The URL does not change while the 404 shows: nothing to subscribe to. */
const noSubscription = () => () => {};
const urlLocale = (): Locale => splitLocale(window.location.pathname).locale;

/**
 * The 404 page: the site's header, what happened and the two ways on (the free generator, the
 * signed-in codes) beside an empty print proof, then the footer. It has no route, so the server
 * renders English; in the browser the text switches to the language of the URL ("/vi/nope" ->
 * Vietnamese) and <html lang> and the title follow.
 */
export function NotFoundContent() {
  // The URL's language in the browser, English on the server (the page has no route there).
  const locale = useSyncExternalStore<Locale>(noSubscription, urlLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = NOT_FOUND_MESSAGES[locale];
  const path = (p: string) => localizePath(locale, p);
  return (
    <div className="flex min-h-dvh flex-col">
      {/* React places it in <head>; the route's metadata has none, so this is the page's title. */}
      <title>{t.title}</title>
      <header className="sticky top-0 z-30 border-b border-border bg-header shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href={path("/")} aria-label={t.home} className="inline-flex min-h-11 items-center">
            <Logo />
          </a>
          <div className="flex shrink-0 items-center gap-2 text-sm whitespace-nowrap sm:gap-4">
            <a href={path("/login")} className={navLink}>
              {t.login}
            </a>
            <a href={path("/register")} className={navLink}>
              {t.signup}
            </a>
          </div>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-12 px-4 py-12 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-20">
        <div className="flex max-w-xl flex-col gap-5">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{t.heading}</h1>
          <p className="text-lg text-pretty text-muted">{t.lead}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={path("/")}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
            >
              {t.create}
              <ArrowRight aria-hidden="true" className="size-4" />
            </a>
            <a href={path("/app")} className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-4 hover:underline">
              {t.codes}
            </a>
          </div>
        </div>
        <EmptyProof t={t} />
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-sm text-muted">
        <a href={path("/report")} className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline">
          {t.report}
        </a>
      </footer>
    </div>
  );
}

/**
 * An empty print proof: white paper in its crop marks, a dashed place where the code should
 * stand, and a scanner's line that found nothing. DESIGN.md never shows a
 * code that cannot scan, so the 404 is the code's absence, not a broken code.
 */
function EmptyProof({ t }: { t: NotFoundMessages }) {
  return (
    <svg role="img" aria-label={t.art} viewBox="0 0 320 320" className="mx-auto w-full max-w-[16rem] text-foreground sm:max-w-[22rem] lg:mr-0">
      {/* The sheet: paper white, outlined like every structure (Rule). */}
      <rect x="20" y="20" width="280" height="280" rx="2" className="fill-white stroke-border" strokeWidth="1.5" />
      {/* Crop marks at the sheet's corners. */}
      <path d="M4 44V4h40 M276 4h40v40 M316 276v40h-40 M44 316H4v-40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
      {/* Where the code should stand. */}
      <rect x="72" y="72" width="176" height="176" rx="2" fill="none" className="stroke-control" strokeWidth="2" strokeDasharray="8 8" />
      <text x="160" y="176" textAnchor="middle" className="fill-muted" fontSize="48" fontWeight="600" letterSpacing="-1">
        404
      </text>
      {/* The scanner's pass across the empty place, finding nothing (neutral: teal is for actions). */}
      <line x1="56" y1="208" x2="264" y2="208" className="stroke-control" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
