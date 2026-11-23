import type { Metadata } from "next";
import { Security } from "@/features/account/security";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: pageTitle((await getMessages()).account.tabs.security) };
}

export default async function SecurityPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <Security t={t.account} auth={t.auth} locale={locale} />;
}
