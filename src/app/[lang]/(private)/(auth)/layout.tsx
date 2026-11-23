import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { SITE_NAME } from "@/lib/site";

/** Auth pages: the masthead, then one narrow column holding a single task. */
export default async function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <>
      <header className="border-b border-border bg-header">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={localizePath(locale, "/")} className="inline-flex min-h-11 items-center font-semibold">
            {SITE_NAME}
          </Link>
          <LanguageSwitcher locale={locale} label={t.nav.language} />
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-10 sm:py-16">{children}</main>
    </>
  );
}
