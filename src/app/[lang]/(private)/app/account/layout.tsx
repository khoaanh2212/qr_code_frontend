import type { Metadata } from "next";
import { AccountTabs } from "@/features/account/account-tabs";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: pageTitle((await getMessages()).account.title) };
}

/** Account pages: one heading, a row of tabs, then the tab's sections. */
export default async function AccountLayout({ children }: LayoutProps<"/[lang]/app/account">) {
  const locale = await getLocale();
  const t = (await getMessages()).account;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <AccountTabs t={t} locale={locale} />
      <div>{children}</div>
    </div>
  );
}
