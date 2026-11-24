import Link from "next/link";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { TYPE_PAGES, type TypePageType } from "@/lib/qr/type-pages";

type T = Messages["typePages"];

/**
 * Links to every per-type page, for visitors and for crawlers (internal links are how search
 * engines find and weigh these pages, so the anchors carry the search phrase: "Wi-Fi QR code").
 * The page being viewed is shown but not linked. A section, not a nav: the footer's
 * TypeFooterLinks is the one navigation landmark for these links.
 */
export function TypeLinks({ locale, t, current }: { locale: Locale; t: T; current?: TypePageType }) {
  return (
    <section aria-labelledby="type-links-heading" className="flex flex-col gap-3 border-t border-border pt-8">
      <h2 id="type-links-heading" className="text-lg font-semibold">
        {t.allTypes}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {TYPE_PAGES.map(({ slug, type }) => {
          const label = t.pages[type].linkLabel;
          const chip = "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium";
          return (
            <li key={slug}>
              {type === current ? (
                <span aria-current="page" className={`${chip} border-accent bg-accent-soft`}>
                  {label}
                </span>
              ) : (
                <Link
                  href={localizePath(locale, `/${slug}`)}
                  className={`${chip} border-border bg-surface text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground`}
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The same links as a quiet row in the footer of every public page. */
export function TypeFooterLinks({ locale, t }: { locale: Locale; t: T }) {
  return (
    <nav aria-label={t.allTypes}>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {TYPE_PAGES.map(({ slug, type }) => (
          <li key={slug}>
            <Link
              href={localizePath(locale, `/${slug}`)}
              className="inline-flex min-h-11 items-center underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-current"
            >
              {t.pages[type].linkLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
