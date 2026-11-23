import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.loginTitle };
}

export default async function LoginPage() {
  const t = await getMessages();
  return <h1 className="text-2xl font-semibold">{t.auth.loginTitle}</h1>;
}
