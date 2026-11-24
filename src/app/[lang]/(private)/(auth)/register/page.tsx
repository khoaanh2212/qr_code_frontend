import type { Metadata } from "next";
import { RedirectIfSignedIn } from "@/features/auth/redirect-if-signed-in";
import { RegisterForm } from "@/features/auth/register-form";
import { getCaptchaConfig } from "@/features/auth/server";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.registerTitle };
}

export default async function RegisterPage() {
  const locale = await getLocale();
  const t = (await getMessages()).auth;
  return (
    <>
      <RedirectIfSignedIn locale={locale} />
      <RegisterForm t={t} locale={locale} captcha={await getCaptchaConfig()} />
    </>
  );
}
