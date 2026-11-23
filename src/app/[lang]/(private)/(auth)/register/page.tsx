import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.registerTitle };
}

export default async function RegisterPage() {
  const t = await getMessages();
  return <h1 className="text-2xl font-semibold">{t.auth.registerTitle}</h1>;
}
