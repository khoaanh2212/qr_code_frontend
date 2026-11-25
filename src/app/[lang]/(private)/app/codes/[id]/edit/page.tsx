import type { Metadata } from "next";
import { CodeContent } from "@/features/codes/pages/code-content";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.codes.pages.contentTitle) };
}

/** The code's id is read on the client (useParams): the page holds nothing per code on the server. */
export default async function CodeContentPage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <CodeContent t={t.codes} auth={t.auth} locale={locale} />;
}
