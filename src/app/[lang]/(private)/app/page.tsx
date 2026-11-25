import { CodesList } from "@/features/codes/list/codes-list";
import { getLocale, getMessages } from "@/i18n/server";

export default async function DashboardPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <CodesList t={t.codes} auth={t.auth} templatesLabel={t.templates.manage} locale={locale} />;
}
