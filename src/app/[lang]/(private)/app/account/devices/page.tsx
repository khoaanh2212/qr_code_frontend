import type { Metadata } from "next";
import { Devices } from "@/features/account/devices";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return { title: pageTitle((await getMessages()).account.tabs.devices) };
}

export default async function DevicesPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <Devices t={t.account} auth={t.auth} locale={locale} />;
}
