"use client";

import { Download } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Select, type SelectOption } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { CodeStats } from "@/lib/api/types";
import { codeStats } from "../api";
import { CampaignSection } from "../campaign/campaign-section";
import { CodePageState } from "../pages/code-page-state";
import { useCode } from "../use-code";
import { CodeHeader } from "./code-header";
import { displayUrl } from "../list/code-card";
import { CodeThumbnail } from "../list/code-thumbnail";
import { TopList, dayLabel } from "../scan-chart";
import { BROWSER_NAMES, OS_NAMES, countryName, familyName, rankByLabel } from "./breakdown";
import { PeriodChart } from "./period-chart";
import { MAX_RANGE_DAYS, PRESET_DAYS, bucketize, csvOf, presetRange, totalsOf, utcToday, validRange, type Bucket, type PresetDays, type Range } from "./range";

type T = Messages["codes"];
type Choice = `${PresetDays}` | "custom";

type StatsLoad = { key: string; stats: CodeStats | null; failed: boolean };

const DEFAULT_DAYS: PresetDays = 30;
const keyOf = (r: Range) => `${r.from}:${r.to}`;

/**
 * A code's insights: what it is (name, status, the code itself and its short link), then its scans
 * over a chosen period: totals, a chart by day, week or month, and where the scans came from.
 * It is the code's home: its header carries the ways to change it (content and design pages, a
 * menu of dialogs), and its campaign details sit under it. The stats API answers a
 * period of days, so grouping and the CSV export are made here from what it sent.
 */
export function CodeInsights({ t, auth, locale }: { t: T; auth: AuthMessages; locale: Locale }) {
  const { id } = useParams<{ id: string }>();
  // Keyed by the code: another code's page starts from nothing, never from this one's numbers.
  return <Insights key={id} id={id} t={t} auth={auth} locale={locale} />;
}

/** Above this many days a period opens grouped by week: a bar per day would be a hairline. */
const WEEKLY_FROM_DAYS = 92;
const spanDays = (r: Range) => Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;

function Insights({ id, t, auth, locale }: { id: string; t: T; auth: AuthMessages; locale: Locale }) {
  const i = t.insights;
  const { load, setCode, workspaceId: ws, canEdit } = useCode(id);
  const [choice, setChoice] = useState<Choice>(`${DEFAULT_DAYS}`);
  // The custom period as typed; `range` follows it only while it is one the API accepts.
  const [typed, setTyped] = useState<Range>(() => presetRange(DEFAULT_DAYS));
  const [range, setRange] = useState<Range>(() => presetRange(DEFAULT_DAYS));
  const [bucket, setBucket] = useState<Bucket>("day");
  const [result, setResult] = useState<StatsLoad | null>(null);
  const [attempt, setAttempt] = useState(0);

  const key = keyOf(range);
  useEffect(() => {
    if (!ws) return;
    const abort = new AbortController();
    codeStats(ws, id, range, abort.signal)
      .then((stats) => setResult({ key, stats, failed: false }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setResult({ key, stats: null, failed: true });
      });
    return () => abort.abort();
    // `range` is named by `key`; `attempt` asks again after a failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, id, key, attempt]);

  // `current` is the answer for the period chosen. While the next one loads, the last answer
  // stays on screen, dimmed, so the page does not collapse and jump.
  const current = result?.key === key ? result : null;
  const loading = !current;
  const stats = (current ?? result)?.stats ?? null;
  const periods = useMemo(() => (stats ? bucketize(stats.daily, bucket) : []), [stats, bucket]);
  const totals = useMemo(() => (stats ? totalsOf(stats.daily) : null), [stats]);
  // One source for "are there scans": the days the figures and the chart are made of.
  const scans = totals?.scans ?? 0;

  if (load.kind !== "ready" || !ws) return <CodePageState t={t} locale={locale} load={load} loading={i.loading} />;
  const { code } = load;

  function choose(next: Choice) {
    setChoice(next);
    if (next === "custom") return setTyped(range); // starts from what is shown
    setRange(presetRange(Number(next) as PresetDays));
  }
  function type(next: Range) {
    setTyped(next);
    if (!validRange(next)) return;
    setRange(next);
    if (bucket === "day" && spanDays(next) > WEEKLY_FROM_DAYS) setBucket("week");
  }
  function downloadCsv() {
    const csv = csvOf(periods, { start: i.from, end: i.to, scans: t.scansColumn, unique: t.uniqueColumn });
    // The byte order mark tells Excel the file is UTF-8 (the headings are translated).
    const name = `${code.short_code.replace(/[^A-Za-z0-9_-]/g, "_")}-${range.from}-${range.to}.csv`;
    save(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), name);
  }

  const nf = new Intl.NumberFormat(locale);
  const choices: SelectOption<Choice>[] = [
    ...PRESET_DAYS.map((d) => ({ value: `${d}` as Choice, label: { 7: i.range7, 30: i.range30, 90: i.range90 }[d] })),
    { value: "custom", label: i.rangeCustom },
  ];
  const buckets: SelectOption<Bucket>[] = [
    { value: "day", label: i.bucketDay },
    { value: "week", label: i.bucketWeek },
    { value: "month", label: i.bucketMonth },
  ];
  const devices: Record<string, string> = t.deviceNames;
  // A date still being typed (an empty field) is not an error yet; the data shown stays as it was.
  const typedInvalid = choice === "custom" && typed.from !== "" && typed.to !== "" && !validRange(typed);
  const shown = `${dayLabel(range.from, locale)} – ${dayLabel(range.to, locale)}`;
  const rangeError = typedInvalid ? format(i.rangeInvalid, { days: MAX_RANGE_DAYS }) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <TextLink href={localizePath(locale, "/app")}>← {t.back}</TextLink>
      {/* What the code is: facts and totals on the left, the code itself on the right from `lg`. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <CodeHeader t={t} auth={auth} locale={locale} ws={ws} code={code} canEdit={canEdit} onSaved={setCode} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Tile label={i.totalScans} value={totals ? nf.format(totals.scans) : "–"} />
            <Tile label={i.uniqueScans} value={totals ? nf.format(totals.unique) : "–"} help={i.uniqueHelp} />
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-5">
          <CodeThumbnail workspaceId={ws} code={code} className="w-40" />
          <div className="flex max-w-full min-w-0 items-center gap-1">
            <span className="truncate font-mono text-sm">{displayUrl(code.short_url)}</span>
            <CopyButton value={code.short_url} label={t.list.copyLink} copiedLabel={t.list.copied} failedLabel={t.list.copyFailed} />
          </div>
        </div>
      </div>

      <CampaignSection t={t} auth={auth} locale={locale} ws={ws} code={code} canEdit={canEdit} onSaved={setCode} />

      <section aria-labelledby="scans-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <h2 id="scans-heading" className="mr-2 text-xl font-semibold">
              {t.scansTitle}
            </h2>
            <Select label={i.range} hideLabel value={choice} options={choices} onChange={choose} />
            <Select label={i.bucket} hideLabel value={bucket} options={buckets} onChange={setBucket} />
          </div>
          {stats && scans > 0 && (
            <Button variant="secondary" onClick={downloadCsv}>
              <Download aria-hidden="true" className="size-4" />
              {i.downloadCsv}
            </Button>
          )}
        </div>
        {choice === "custom" && (
          <div className="flex flex-col gap-2">
            <div className="grid max-w-md gap-3 sm:grid-cols-2">
              <TextField
                type="date"
                label={i.from}
                max={typed.to || utcToday()}
                value={typed.from}
                error={rangeError}
                onChange={(e) => type({ ...typed, from: e.target.value })}
              />
              <TextField
                type="date"
                label={i.to}
                min={typed.from}
                max={utcToday()}
                value={typed.to}
                aria-invalid={typedInvalid || undefined}
                onChange={(e) => type({ ...typed, to: e.target.value })}
              />
            </div>
          </div>
        )}
        {/* The period the figures below are for (a custom one being typed has not taken over yet). */}
        <p className="text-xs text-pretty text-muted">
          <span className="font-medium text-foreground tabular-nums">{shown}</span> · {i.note}
        </p>
        {/* Heard when another period has loaded: the page gives no other cue to a screen reader. */}
        <p role="status" className="sr-only">
          {loading ? i.loading : totals ? `${shown}: ${i.totalScans} ${nf.format(totals.scans)}, ${i.uniqueScans} ${nf.format(totals.unique)}` : ""}
        </p>

        {current?.failed && (
          <div className="flex flex-col items-start gap-2">
            <FormAlert message={t.loadFailed} />
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null); // the failure goes, "loading" shows
                setAttempt((n) => n + 1);
              }}
            >
              {t.retry}
            </Button>
          </div>
        )}
        {loading && !stats && <p className="text-sm text-muted">{i.loading}</p>}
        <div aria-busy={loading || undefined} className={`flex flex-col gap-4 transition-opacity duration-150 ${loading ? "opacity-60" : ""}`}>
        {stats && scans === 0 && (
          <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-6">
            <p className="font-semibold">{i.emptyTitle}</p>
            <p className="text-sm text-pretty text-muted">{i.emptyIntro}</p>
          </div>
        )}
        {stats && scans > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={i.overTime} className="lg:col-span-2">
              <PeriodChart t={t} locale={locale} periods={periods} />
            </Panel>
            <Panel>
              <TopList title={i.os} limit={8} entries={rankByLabel(stats.os, scans, (v) => familyName(OS_NAMES, v, i.other, t.unknown))} locale={locale} label={(name) => name} />
            </Panel>
            <Panel>
              <TopList title={t.countries} limit={8} entries={rankByLabel(stats.countries, scans, (v) => countryName(v, locale, t.unknown))} locale={locale} label={(name) => name} />
            </Panel>
            <Panel>
              <TopList title={t.devices} limit={8} entries={rankByLabel(stats.devices, scans, (v) => (Object.hasOwn(devices, v) ? devices[v] : t.unknown))} locale={locale} label={(name) => name} />
            </Panel>
            <Panel>
              <TopList title={i.browsers} limit={8} entries={rankByLabel(stats.browsers, scans, (v) => familyName(BROWSER_NAMES, v, i.other, t.unknown))} locale={locale} label={(name) => name} />
            </Panel>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}

/** One figure with its name; `help` explains how it is counted. */
function Tile({ label, value, help }: { label: string; value: string; help?: string }) {
  const helpId = useId();
  return (
    <div role="group" aria-label={label} aria-describedby={help ? helpId : undefined} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-5">
      <p aria-hidden="true" className="text-sm font-medium text-muted">
        {label}
      </p>
      <p className="text-3xl leading-tight font-semibold tabular-nums">{value}</p>
      {help && (
        <p id={helpId} className="text-xs text-pretty text-muted">
          {help}
        </p>
      )}
    </div>
  );
}

function Panel({ title, className = "", children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-5 ${className}`}>
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {children}
    </div>
  );
}

/** Hands a file made in the page to the browser's downloads. */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // In the page while it is clicked, and the URL kept a moment: some browsers need both.
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
