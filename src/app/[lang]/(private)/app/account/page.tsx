import { Profile } from "@/features/account/profile";
import { getCaptchaConfig } from "@/features/auth/server";
import { getLocale, getMessages } from "@/i18n/server";

export default async function ProfilePage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <Profile t={t.account} auth={t.auth} locale={locale} captcha={await getCaptchaConfig()} />;
}
