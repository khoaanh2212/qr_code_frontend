import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AccountLink } from "@/features/app-shell/account-link";
import { AppFrame } from "@/features/app-shell/app-frame";
import { LogoutButton } from "@/features/auth/logout-button";
import { RequireSession } from "@/features/auth/require-session";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle, SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.nav.dashboard) };
}

/** The logged-in app: `AppFrame` gives the codes list the full width and every other page a centered column. */
export default async function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <AppFrame
      masthead={
        <>
          {/* The brand leads to the dashboard, which the link's label names for screen readers. */}
          <Link href={localizePath(locale, "/app")} aria-label={`${SITE_NAME} – ${t.nav.dashboard}`} className="inline-flex min-h-11 items-center">
            <Logo />
          </Link>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-3">
            <AccountLink label={t.nav.account} locale={locale} />
            <LanguageSwitcher locale={locale} label={t.nav.language} />
            <LogoutButton t={t.auth} locale={locale} />
          </div>
        </>
      }
    >
      <RequireSession messages={t.session}>{children}</RequireSession>
    </AppFrame>
  );
}
