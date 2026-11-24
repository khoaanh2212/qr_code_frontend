import type { Metadata } from "next";
import { QrEditor } from "@/features/qr-editor/qr-editor";
import { alternatesFor } from "@/i18n/metadata";
import { getLocale, getMessages } from "@/i18n/server";
import { typePagePath, type TypePageType } from "@/lib/qr/type-pages";
import { SITE_NAME } from "@/lib/site";
import { TypeGuide } from "./type-guide";
import { TypeLinks } from "./type-links";

/**
 * Per-type landing page ("/wifi-qr-code"): the generator opened on one type, with that type's
 * guide and questions. Each slug has its own static route folder under
 * src/app/[lang]/(marketing)/ that only calls these two, so unknown paths stay a real 404.
 */
export async function typePageMetadata(type: TypePageType): Promise<Metadata> {
  const t = await getMessages();
  const locale = await getLocale();
  const text = t.typePages.pages[type];
  // No `openGraph` here: a page-level openGraph object replaces the one built from the
  // segment's opengraph-image file, and link previews would lose their image.
  return {
    title: { absolute: `${text.title} | ${SITE_NAME}` },
    description: text.description,
    alternates: alternatesFor(locale, typePagePath(type)),
  };
}

export async function TypePage({ type }: { type: TypePageType }) {
  const locale = await getLocale();
  const t = await getMessages();
  const text = t.typePages.pages[type];
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{text.title}</h1>
          <p className="max-w-prose text-pretty text-muted">{text.intro}</p>
        </header>
        <QrEditor t={t.generator} templates={t.templates} initialType={type} locale={locale} />
      </div>
      <TypeGuide t={t.typePages} type={type} />
      <TypeLinks locale={locale} t={t.typePages} current={type} />
    </div>
  );
}
