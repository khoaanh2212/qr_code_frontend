import type { Metadata } from "next";
import { RedirectIfSignedIn } from "@/features/auth/redirect-if-signed-in";
import { VerifyLogin } from "@/features/auth/verify-login";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.verify.title };
}

/** The second login step for accounts with two-step verification (backend PLAN item 31). */
export default async function VerifyLoginPage() {
  const locale = await getLocale();
  const t = (await getMessages()).auth;
  return (
    <>
      <RedirectIfSignedIn locale={locale} />
      <h1 className="text-2xl font-semibold">{t.verify.title}</h1>
      <VerifyLogin t={t} locale={locale} />
    </>
  );
}
