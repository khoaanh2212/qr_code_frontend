import type { Metadata } from "next";
import { CodeInsights } from "@/features/codes/insights/code-insights";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.codes.insights.title) };
}

/** The code's id is read on the client (useParams): the page holds nothing per code on the server. */
export default async function CodeInsightsPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <CodeInsights t={t.codes} locale={locale} />;
}
