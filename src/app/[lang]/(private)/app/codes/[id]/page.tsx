import type { Metadata } from "next";
import { CodeDetail } from "@/features/codes/code-detail";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.codes.title) };
}

/** The code's id is read on the client (useParams): the page holds nothing per code on the server. */
export default async function CodePage() {
  const locale = await getLocale();
  const t = await getMessages();
  return <CodeDetail t={t.codes} generator={t.generator} auth={t.auth} locale={locale} />;
}
