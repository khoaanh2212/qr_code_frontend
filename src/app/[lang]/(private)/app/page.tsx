import { Welcome } from "@/features/dashboard/welcome";
import { getMessages } from "@/i18n/server";

export default async function DashboardPage() {
  const t = await getMessages();
  return <Welcome template={t.dashboard.welcome} />;
}
