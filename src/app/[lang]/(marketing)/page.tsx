import type { Metadata } from "next";
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
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t.home.title}</h1>
      <p className="max-w-prose text-black/70 dark:text-white/70">{t.home.intro}</p>
      {/* The generator (features/qr-editor) goes here. */}
    </section>
  );
}
