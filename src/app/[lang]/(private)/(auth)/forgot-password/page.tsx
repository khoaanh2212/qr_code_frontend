import type { Metadata } from "next";
import { ForgotForm } from "@/features/auth/forgot-form";
import { getCaptchaConfig } from "@/features/auth/server";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.forgotPasswordTitle };
}

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const t = (await getMessages()).auth;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.forgotPasswordTitle}</h1>
      <ForgotForm t={t} locale={locale} captcha={await getCaptchaConfig()} />
    </>
  );
}
