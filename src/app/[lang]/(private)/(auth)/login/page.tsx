import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { RedirectIfSignedIn } from "@/features/auth/redirect-if-signed-in";
import { ReturnToLink } from "@/features/auth/form-bits";
import { localizePath } from "@/i18n/config";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.loginTitle };
}

export default async function LoginPage() {
  const locale = await getLocale();
  const t = (await getMessages()).auth;
  return (
    <>
      <RedirectIfSignedIn locale={locale} />
      <h1 className="text-2xl font-semibold">{t.loginTitle}</h1>
      <LoginForm t={t} locale={locale} />
      <ReturnToLink href={localizePath(locale, "/register")}>{t.toRegister}</ReturnToLink>
    </>
  );
}
