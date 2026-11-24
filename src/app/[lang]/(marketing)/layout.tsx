import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { baseMetadata, RootDocument } from "@/components/root-document";
import { TypeFooterLinks } from "@/features/qr-type-pages/type-links";
import { LOCALES, localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";

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
    <RootDocument locale={locale} googleConnected={{ message: t.auth.googleConnected, dismiss: t.auth.noticeDismiss }}>
      <header className="border-b border-border bg-header">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={localizePath(locale, "/")} className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <div className="flex items-center gap-2 text-sm sm:gap-4">
            <LanguageSwitcher locale={locale} label={t.nav.language} />
            <Link href={localizePath(locale, "/login")} className="inline-flex min-h-11 items-center px-1">
              {t.nav.login}
            </Link>
            <Link href={localizePath(locale, "/register")} className="inline-flex min-h-11 items-center px-1">
              {t.nav.signup}
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
      {/* pb-28 below lg: every public page has the generator, whose fixed mobile preview bar
          would otherwise cover the end of the footer. */}
      <footer className="flex flex-col gap-3 border-t border-border px-4 pt-6 pb-28 text-center text-sm text-muted lg:pb-6">
        <TypeFooterLinks locale={locale} t={t.typePages} />
        <p>{t.footer.staticForever}</p>
      </footer>
    </RootDocument>
  );
}
