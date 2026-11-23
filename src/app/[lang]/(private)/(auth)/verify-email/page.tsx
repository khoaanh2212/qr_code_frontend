import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.verifyEmailTitle };
}

export default async function VerifyEmailPage() {
  const t = await getMessages();
  return <h1 className="text-2xl font-semibold">{t.auth.verifyEmailTitle}</h1>;
}
