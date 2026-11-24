import type { Metadata } from "next";
import { getCaptchaConfig } from "@/features/auth/server";
import { ReportForm } from "@/features/report/report-form";
import { parseShortCode } from "@/features/report/short-code";
import { getLocale, getMessages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getMessages()).report.title };
}

/** Report a short link: `?code=` prefills it (only a well-formed code is taken). */
export default async function ReportPage({ searchParams }: PageProps<"/[lang]/report">) {
  const locale = await getLocale();
  const t = (await getMessages()).report;
  const raw = (await searchParams).code;
  const initialCode = typeof raw === "string" ? (parseShortCode(raw) ?? undefined) : undefined;
  return (
    <>
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <ReportForm t={t} locale={locale} captcha={await getCaptchaConfig()} initialCode={initialCode} />
    </>
  );
}
