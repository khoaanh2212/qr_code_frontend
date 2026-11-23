import type { Metadata } from "next";
import { getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).auth.forgotPasswordTitle };
}

export default async function ForgotPasswordPage() {
  const t = await getMessages();
  return <h1 className="text-2xl font-semibold">{t.auth.forgotPasswordTitle}</h1>;
}
