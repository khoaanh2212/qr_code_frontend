import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { baseMetadata, RootDocument } from "@/components/root-document";
import { LOCALES, localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { SITE_NAME } from "@/lib/site";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { ...baseMetadata, description: t.home.description };
}

/**
 * Root layout of the public pages: prerendered per locale and cached at the CDN, indexed.
 * Rules (see README): no user-supplied content, no request input, only `publicApi` (no
 * cookies). Links into the private pages are full page loads (other root layout).
 */
export default async function MarketingLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <RootDocument locale={locale}>
      <header className="border-b border-black/10 dark:border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href={localizePath(locale, "/")} className="font-semibold">
            {SITE_NAME}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <LanguageSwitcher locale={locale} label={t.nav.language} />
            <Link href={localizePath(locale, "/login")}>{t.nav.login}</Link>
            <Link href={localizePath(locale, "/register")}>{t.nav.signup}</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-black/10 py-6 text-center text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        {t.footer.staticForever}
      </footer>
    </RootDocument>
  );
}
