import type { Metadata } from "next";
import { getCaptchaConfig } from "@/features/auth/server";
import { VerifyEmail } from "@/features/auth/verify-email";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.verifyEmailTitle };
}

export default async function VerifyEmailPage() {
  const locale = await getLocale();
  const t = (await getMessages()).auth;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.verifyEmailTitle}</h1>
      <VerifyEmail t={t} locale={locale} captcha={await getCaptchaConfig()} />
    </>
  );
}
