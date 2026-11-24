import Link from "next/link";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { TYPE_PAGES, type TypePageType } from "@/lib/qr/type-pages";

/**
 * Links to every per-type page, for visitors and for crawlers (internal links are how search
 * engines find and weigh these pages). The page being viewed is shown but not linked.
 */
export function TypeLinks({ locale, t, current }: { locale: Locale; t: Messages; current?: TypePageType }) {
  return (
    <nav aria-labelledby="type-links-heading" className="flex flex-col gap-3 border-t border-border pt-8">
      <h2 id="type-links-heading" className="text-lg font-semibold">
        {t.typePages.allTypes}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {TYPE_PAGES.map(({ slug, type }) => {
          const label = t.generator.types[type];
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
    </nav>
  );
}
