import type { Metadata } from "next";
import { getCaptchaConfig } from "@/features/auth/server";
import { CodeForm } from "@/features/codes/code-form";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.codes.newTitle) };
}

export default async function NewCodePage() {
  const locale = await getLocale();
  const t = await getMessages();
  return (
    <CodeForm t={t.codes} generator={t.generator} pages={t.pages} templates={t.templates} uploads={t.uploads} auth={t.auth} locale={locale} captcha={await getCaptchaConfig()} />
  );
}
