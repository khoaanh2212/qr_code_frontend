import type { Metadata } from "next";
import { TemplatesPage } from "@/features/templates/templates-page";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.templates.title) };
}

export default async function DesignTemplatesPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <TemplatesPage t={t.templates} back={t.codes.back} locale={locale} />;
}
