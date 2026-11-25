import type { Metadata } from "next";
import { CodeHome } from "@/features/codes/pages/code-home";
import { getLocale, getMessages } from "@/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: pageTitle(t.codes.insights.title) };
}

/** A code's home is its insights page (the id is read on the client, as on every page of a code). */
export default async function CodePage() {
  return <CodeHome locale={await getLocale()} />;
}
