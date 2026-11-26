import type { Metadata } from "next";
import { CodeDesign } from "@/features/codes/pages/code-design";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.codes.designTitle) };
}

/** The code's id is read on the client (useParams): the page holds nothing per code on the server. */
export default async function CodeDesignPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <CodeDesign t={t.codes} generator={t.generator} templates={t.templates} uploads={t.uploads} auth={t.auth} locale={locale} />;
}
