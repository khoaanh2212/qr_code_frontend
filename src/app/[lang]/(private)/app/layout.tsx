import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
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
      <header className="border-b border-black/10 dark:border-white/10">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href={localizePath(locale, "/app")} className="font-semibold">
            {t.nav.dashboard}
          </Link>
          <LanguageSwitcher locale={locale} label={t.nav.language} />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <RequireSession messages={t.session}>{children}</RequireSession>
      </main>
    </>
  );
}
