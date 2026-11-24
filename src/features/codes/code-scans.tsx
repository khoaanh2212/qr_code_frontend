"use client";

import { useEffect, useState } from "react";

import { Section } from "@/features/account/section";
import { FormAlert } from "@/components/form/form-bits";

import { redirectToLogin } from "@/features/auth/require-session";
import { format, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { CodeStats, DynamicCode } from "@/lib/api/types";

import { codeStats } from "./api";

import { ScanChart, TopList } from "./scan-chart";

type T = Messages["codes"];

// A code's scans: 30 days by day, top countries and devices.

/** ISO 3166 alpha-2 as a country name in the page's language; anything else is "Unknown". */
function countryName(value: string, locale: Locale, unknown: string): string {
  if (!/^[A-Z]{2}$/.test(value) || value === "XX" || value === "T1") return unknown;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(value) ?? value;
  } catch {
    return value;
  }
}

/** Scans the API left out of a breakdown (e.g. no known country) become one "" (unknown) entry. */
export function withRemainder(entries: CodeStats["countries"], total: number): CodeStats["countries"] {
  const rest = total - entries.reduce((sum, e) => sum + e.scans, 0);
  if (rest <= 0) return entries;
  const known = entries.filter((e) => e.value !== "");
  const unknown = rest + (entries.find((e) => e.value === "")?.scans ?? 0);
  return [...known, { value: "", scans: unknown }].sort((a, b) => b.scans - a.scans);
}

export function ScansSection({ t, locale, ws, code }: { t: T; locale: Locale; ws: string; code: DynamicCode }) {
  const [stats, setStats] = useState<CodeStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    codeStats(ws, code.id, abort.signal)
      .then(setStats)
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setFailed(true);
      });
    return () => abort.abort();
  }, [ws, code.id]);

  const nf = new Intl.NumberFormat(locale);
  const devices: Record<string, string> = t.deviceNames;
  return (
    <Section title={t.scansTitle} description={t.scansIntro}>
      {failed && <FormAlert message={t.loadFailed} />}
      {!stats && !failed && (
        <p role="status" className="text-sm text-muted">
          {t.scansTitle}…
        </p>
      )}
      {stats && (
        <div className="flex flex-col gap-5">
          <p className="text-3xl font-semibold tabular-nums">
            {format(t.scansTotal, { count: nf.format(stats.scans) })}
          </p>
          {stats.scans === 0 ? (
            <p className="text-sm text-muted">{t.noScans}</p>
          ) : (
            <>
              <ScanChart t={t} locale={locale} daily={stats.daily} />
              <div className="grid gap-6 sm:grid-cols-2">
                <TopList
                  title={t.countries}
                  entries={withRemainder(stats.countries, stats.scans)}
                  locale={locale}
                  label={(v) => countryName(v, locale, t.unknown)}
                />
                <TopList
                  title={t.devices}
                  entries={withRemainder(stats.devices, stats.scans)}
                  locale={locale}
                  label={(v) => (Object.hasOwn(devices, v) ? devices[v] : t.unknown)}
                />
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}
