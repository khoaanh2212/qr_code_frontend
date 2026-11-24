import type { Metadata } from "next";
import { ResetForm } from "@/features/auth/reset-form";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.resetPasswordTitle };
}

export default async function ResetPasswordPage() {
  const locale = await getLocale();
  const t = (await getMessages()).auth;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.resetPasswordTitle}</h1>
      <ResetForm t={t} locale={locale} />
    </>
  );
}
