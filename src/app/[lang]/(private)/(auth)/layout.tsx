import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { SITE_NAME } from "@/lib/site";

/** Auth pages: login, sign-up, email verification, password reset. */
export default async function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href={localizePath(locale, "/")} className="font-semibold">
          {SITE_NAME}
        </Link>
        <LanguageSwitcher locale={locale} label={t.nav.language} />
      </div>
      {children}
    </main>
  );
}
