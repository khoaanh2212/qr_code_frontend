import type { Metadata } from "next";
import { ReturnToLink } from "@/features/auth/form-bits";
import { RedirectIfSignedIn } from "@/features/auth/redirect-if-signed-in";
import { RegisterForm } from "@/features/auth/register-form";
import { getCaptchaConfig } from "@/features/auth/server";
import { localizePath } from "@/i18n/config";
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.registerTitle}</h1>
        <p className="text-sm text-pretty text-muted">{t.registerIntro}</p>
      </div>
      <RegisterForm t={t} locale={locale} captcha={await getCaptchaConfig()} />
      <ReturnToLink href={localizePath(locale, "/login")}>{t.toLogin}</ReturnToLink>
    </>
  );
}
