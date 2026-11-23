import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoutButton } from "@/features/auth/logout-button";
import { RequireSession } from "@/features/auth/require-session";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.nav.dashboard };
}

/** The logged-in app. */
export default async function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <>
      <header className="border-b border-border bg-header">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <Link href={localizePath(locale, "/app")} className="inline-flex min-h-11 items-center font-semibold">
            {t.nav.dashboard}
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <LanguageSwitcher locale={locale} label={t.nav.language} />
            <LogoutButton t={t.auth} locale={locale} />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <RequireSession messages={t.session}>{children}</RequireSession>
      </main>
    </>
  );
}
