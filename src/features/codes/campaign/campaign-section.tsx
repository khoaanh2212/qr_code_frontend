"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { Section, SavedNote } from "@/features/account/section";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { Campaign, CampaignMedium, DynamicCode } from "@/lib/api/types";
import { getCode, updateCode } from "../api";
import { campaignFailure, campaignProblem } from "./errors";
import {
  CAMPAIGN_LIMITS,
  DIGITAL_MEDIA,
  EMPTY_CAMPAIGN,
  OTHER_MEDIUM,
  PRINT_MEDIA,
  campaignOf,
  draftOf,
  isEmptyCampaign,
  sameCampaign,
  validateCampaign,
  type CampaignDraft,
  type CampaignField,
} from "./rules";

type T = Messages["codes"];

type Props = {
  t: T;
  auth: AuthMessages;
  locale: string;
  ws: string;
  code: DynamicCode;
  /** False for viewers: they read the details and get no controls. */
  canEdit: boolean;
  onSaved: (code: DynamicCode) => void;
};

/**
 * A code's campaign details (backend PLAN item 55): when it runs, how many copies are printed and
 * on which medium. Notes only, so everyone in the workspace reads them; editors of an unlocked
 * code change them in a form that replaces the list while it is open.
 */
export function CampaignSection({ t, auth, locale, ws, code, canEdit, onSaved }: Props) {
  const c = t.campaign;
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const openRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const editable = canEdit && code.status !== "locked";
  const open = editing && editable; // a code locked while the form is open closes it
  // An API older than this page (deployed first, or a cached answer) sends no campaign.
  const campaign: Campaign = code.campaign ?? EMPTY_CAMPAIGN;
  const empty = isEmptyCampaign(campaign);

  // The form took the place of the button that opened it: give focus back once the button is
  // there again. A code locked meanwhile has no button; focus then stays in the section, on the
  // details, instead of falling back to the top of the page.
  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      (openRef.current ?? viewRef.current)?.focus();
    }
  }, [open, editing]);

  function close(result?: { note?: string; error?: string }) {
    refocus.current = true;
    setEditing(false);
    setNote(result?.note);
    setError(result?.error);
  }

  return (
    <Section title={c.title} description={c.intro}>
      {open ? (
        <CampaignForm t={t} auth={auth} locale={locale} ws={ws} code={code} campaign={campaign} onSaved={onSaved} onClose={close} />
      ) : (
        <>
          <div ref={viewRef} tabIndex={-1} className="outline-none">
            {empty ? <p className="text-sm text-pretty text-muted">{c.empty}</p> : <CampaignList t={t} locale={locale} campaign={campaign} />}
          </div>
          {editable && (
            <Button
              ref={openRef}
              variant="secondary"
              className="w-fit"
              onClick={() => {
                setNote(undefined);
                setError(undefined);
                setEditing(true);
              }}
            >
              {empty ? c.add : c.edit}
            </Button>
          )}
          <FormAlert message={error} />
          <SavedNote message={note} />
        </>
      )}
    </Section>
  );
}

/** A calendar day in the reader's format. Read as UTC, so it never shifts with the time zone. */
function formatDay(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function CampaignList({ t, locale, campaign }: { t: T; locale: string; campaign: Campaign }) {
  const c = t.campaign;
  // The label of "other" is the customer's own text: rendered as text, like every value here.
  // A medium a newer API knows and this page does not is shown by its API name.
  const known: Partial<Record<string, string>> = c.media;
  const medium =
    campaign.medium === OTHER_MEDIUM ? (campaign.medium_other ?? c.media.other) : campaign.medium ? (known[campaign.medium] ?? campaign.medium) : null;
  const rows: [string, string | null, boolean][] = [
    [c.start, campaign.start_date ? formatDay(campaign.start_date, locale) : null, true],
    [c.end, campaign.end_date ? formatDay(campaign.end_date, locale) : null, true],
    [c.printRun, campaign.print_run === null ? null : new Intl.NumberFormat(locale).format(campaign.print_run), true],
    [c.medium, medium, false],
  ];
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value, numeric]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className={value === null ? "text-muted" : `font-medium break-words ${numeric ? "tabular-nums" : ""}`}>{value ?? c.notSet}</dd>
        </div>
      ))}
    </dl>
  );
}

type FormProps = Omit<Props, "canEdit"> & {
  /** The code's campaign as shown (never missing, unlike `code.campaign` from an older API). */
  campaign: Campaign;
  onClose: (result?: { note?: string; error?: string }) => void;
};

function CampaignForm({ t, auth, locale, ws, code, campaign, onSaved, onClose }: FormProps) {
  const c = t.campaign;
  const [draft, setDraft] = useState<CampaignDraft>(() => draftOf(campaign));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<{ field?: CampaignField; message: string } | null>(null);
  const sending = useRef(false); // state lags a second submit in the same tick
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const runRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const removeRef = useRef<HTMLButtonElement>(null);
  const leftConfirm = useRef(false);
  const fields: Partial<Record<CampaignField, React.RefObject<HTMLInputElement | null>>> = {
    start_date: startRef,
    end_date: endRef,
    print_run: runRef,
    medium_other: otherRef,
  };

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  // Choosing "other" shows its question right below, without moving focus: arrow keys change a
  // select at once on some systems, and the reader must be able to keep going through the list.
  const other = draft.medium === OTHER_MEDIUM;

  // Into the confirmation: the safe choice first. Back out of it (kept, Escape, or a failed
  // removal): the button that asked, so focus never falls back to the top of the page.
  useEffect(() => {
    if (confirming) {
      leftConfirm.current = true;
      keepRef.current?.focus();
    } else if (leftConfirm.current) {
      leftConfirm.current = false;
      removeRef.current?.focus();
    }
  }, [confirming]);

  // While a request runs the form stays: closing it would hide a failure and allow a second save.
  function cancel() {
    if (!busy && !sending.current) onClose();
  }

  function change(patch: Partial<CampaignDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null); // a message describes the old value
  }

  function fail(failure: { field?: CampaignField; message: string }) {
    setError(failure);
    if (failure.field) fields[failure.field]?.current?.focus();
  }

  async function send(next: Campaign | null) {
    if (busy || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateCode(ws, code.id, { campaign: next }));
      onClose({ note: next ? c.saved : c.removed });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (err instanceof ApiError && err.code === "code_locked") {
        // Locked by an operator meanwhile: show the code as it is now, read-only.
        try {
          onSaved(await getCode(ws, code.id));
        } catch {
          // The page keeps what it has; the message below still says why nothing was saved.
        }
        return onClose({ error: t.errors.locked });
      }
      setConfirming(false);
      fail(campaignFailure(err, draft, t, auth, locale));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateCampaign(draft);
    if (problem) return fail({ field: problem.field, message: campaignProblem(problem.problem, t, locale) });
    const next = campaignOf(draft);
    if (next ? sameCampaign(next, campaign) : isEmptyCampaign(campaign)) return cancel();
    void send(next);
  }

  const none: SelectOption<CampaignMedium | ""> = { value: "", label: c.mediumNone };
  const options: SelectOption<CampaignMedium | "">[] = [
    none,
    ...PRINT_MEDIA.map((m) => ({ value: m, label: c.media[m], group: c.groupPrint })),
    ...DIGITAL_MEDIA.map((m) => ({ value: m, label: c.media[m], group: c.groupDigital })),
    { value: OTHER_MEDIUM, label: c.media.other },
  ];
  const errorOf = (field: CampaignField) => (error?.field === field ? error.message : undefined);
  const confirmId = useId();

  if (confirming) {
    return (
      <div
        role="group"
        aria-labelledby={confirmId}
        className="flex flex-col gap-3"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) setConfirming(false);
        }}
      >
        <p id={confirmId} className="text-sm text-pretty">
          {c.removeConfirm}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" busy={busy} onClick={() => void send(null)}>
            {c.removeYes}
          </Button>
          <Button
            ref={keepRef}
            variant="secondary"
            onClick={() => {
              if (!busy) setConfirming(false);
            }}
          >
            {t.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      aria-label={c.edit}
      onSubmit={submit}
      onKeyDown={(e) => {
        // Not while a text is being composed: Escape then only ends the composition.
        if (e.key === "Escape" && !e.nativeEvent.isComposing && !e.defaultPrevented) cancel();
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          ref={startRef}
          type="date"
          label={c.start}
          min={CAMPAIGN_LIMITS.minDate}
          max={CAMPAIGN_LIMITS.maxDate}
          readOnly={busy}
          value={draft.start}
          error={errorOf("start_date")}
          onChange={(e) => change({ start: e.target.value })}
        />
        <TextField
          ref={endRef}
          type="date"
          label={c.end}
          min={draft.start || CAMPAIGN_LIMITS.minDate}
          max={CAMPAIGN_LIMITS.maxDate}
          readOnly={busy}
          value={draft.end}
          error={errorOf("end_date")}
          onChange={(e) => change({ end: e.target.value })}
        />
      </div>
      {/* Not type="number": that accepts "1e5", and the scroll wheel changes the value. */}
      <TextField
        ref={runRef}
        inputMode="numeric"
        autoComplete="off"
        label={c.printRun}
        help={c.printRunHelp}
        className="tabular-nums"
        readOnly={busy}
        value={draft.printRun}
        error={errorOf("print_run")}
        onChange={(e) => change({ printRun: e.target.value })}
      />
      <Select
        stacked
        label={c.medium}
        value={draft.medium}
        options={options}
        onChange={(medium) => {
          if (!busy) change({ medium }); // like the read-only fields: what was sent stays on screen
        }}
      />
      {other && (
        <TextField
          ref={otherRef}
          label={c.otherLabel}
          help={format(c.otherHelp, { max: CAMPAIGN_LIMITS.labelMax })}
          autoComplete="off"
          readOnly={busy}
          value={draft.other}
          error={errorOf("medium_other")}
          onChange={(e) => change({ other: e.target.value })}
        />
      )}
      <FormAlert message={error && !error.field ? error.message : undefined} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy}>
          {t.save}
        </Button>
        <Button variant="secondary" onClick={cancel}>
          {t.cancel}
        </Button>
        {!isEmptyCampaign(campaign) && (
          <Button ref={removeRef} variant="secondary" className="sm:ml-auto" onClick={() => setConfirming(true)}>
            {c.remove}
          </Button>
        )}
      </div>
    </form>
  );
}
