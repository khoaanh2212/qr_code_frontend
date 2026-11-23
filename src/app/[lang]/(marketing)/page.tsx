import type { Metadata } from "next";
import { QrEditor } from "@/features/qr-editor/qr-editor";
import { alternatesFor } from "@/i18n/metadata";
import { getLocale, getMessages } from "@/i18n/server";
import { SITE_NAME } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: { absolute: `${t.home.title} | ${SITE_NAME}` },
    description: t.home.description,
    alternates: alternatesFor(await getLocale(), "/"),
  };
}

export default async function HomePage() {
  const t = await getMessages();
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{t.home.title}</h1>
        <p className="max-w-prose text-muted">{t.home.intro}</p>
      </header>
      <QrEditor t={t.generator} />
    </div>
  );
}
