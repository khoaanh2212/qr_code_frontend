"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { commonErrorMessage, publicApi, toApiError } from "@/lib/api";
import { Captcha, type CaptchaConfig } from "@/features/auth/captcha";
import { FormAlert, Notice, TextLink } from "@/components/form/form-bits";
import { parseShortCode } from "./short-code";

export type ReportMessages = Messages["report"];

/** The reasons the API accepts, in the order they are offered. */
export const REPORT_REASONS = ["phishing", "malware", "scam", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** The API's limit on details, in characters. */
export const MAX_DETAILS = 500;

function failure(err: unknown, t: ReportMessages): { field?: "link" | "reason" | "details"; message: string } {
  const e = toApiError(err);
  const common = commonErrorMessage(e, t.errors);
  if (common !== undefined) return { message: common };
  switch (e.code) {
    case "not_found":
      return { field: "link", message: t.errors.notFound };
    case "validation_error":
      if (e.field === "reason") return { field: "reason", message: t.errors.reasonRequired };
      if (e.field === "short_code") return { field: "link", message: t.errors.linkInvalid };
      if (e.field === "details") return { field: "details", message: format(t.errors.detailsLong, { max: MAX_DETAILS }) };
      return { message: t.errors.generic };
    default:
      return { message: t.errors.generic };
  }
}

/**
 * Anyone reports a short link they think is abusive. Reports go to the operators; they never
 * switch a code off on their own, so the page promises a review, not an outcome.
 */
export function ReportForm({
  t,
  locale,
  captcha,
  initialCode,
}: {
  t: ReportMessages;
  locale: Locale;
  captcha: CaptchaConfig;
  initialCode?: string;
}) {
  const linkRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const detailsId = useId();
  const reasonErrorId = useId();
  const [link, setLink] = useState(initialCode ?? "");
  const [linkProblem, setLinkProblem] = useState<string>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [reasonProblem, setReasonProblem] = useState<string>();
  const [details, setDetails] = useState("");
  const [detailsProblem, setDetailsProblem] = useState<string>();
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const linkError = (v: string) => (v.trim() === "" ? t.errors.linkRequired : parseShortCode(v) ? undefined : t.errors.linkInvalid);
  const detailsLength = [...details].length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const code = parseShortCode(link);
    const lp = linkError(link);
    const rp = reason ? undefined : t.errors.reasonRequired;
    const dp = detailsLength > MAX_DETAILS ? format(t.errors.detailsLong, { max: MAX_DETAILS }) : undefined;
    setLinkProblem(lp);
    setReasonProblem(rp);
    setDetailsProblem(dp);
    setAlert(undefined);
    if (lp) return linkRef.current?.focus();
    if (rp) return reasonRef.current?.focus();
    if (dp) return detailsRef.current?.focus();
    if (!token) return setAlert(t.errors.captchaRequired);

    setBusy(true);
    try {
      await publicApi.request("/v1/reports", {
        method: "POST",
        body: { short_code: code, reason, details: details.trim(), captcha_token: token },
      });
      setSent(true);
    } catch (err) {
      const f = failure(err, t);
      if (f.field === "link") {
        setLinkProblem(f.message);
        linkRef.current?.focus();
      } else if (f.field === "reason") {
        setReasonProblem(f.message);
        reasonRef.current?.focus();
      } else if (f.field === "details") {
        setDetailsProblem(f.message);
        detailsRef.current?.focus();
      } else {
        setAlert(f.message);
      }
    } finally {
      setBusy(false);
      setReset((n) => n + 1);
    }
  }

  const home = <TextLink href={localizePath(locale, "/")}>{t.backHome}</TextLink>;

  if (sent) {
    return (
      <>
        <Notice tone="success" title={t.sentTitle}>
          <p>{t.sentText}</p>
        </Notice>
        {home}
      </>
    );
  }

  return (
    <>
      <p className="-mt-2 text-sm text-pretty text-muted">{t.intro}</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          ref={linkRef}
          label={t.link}
          help={t.linkHelp}
          required
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={link}
          error={linkProblem}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkProblem(undefined);
          }}
          onBlur={() => link && setLinkProblem(linkError(link))}
        />
        <fieldset className="flex flex-col gap-2" aria-describedby={reasonProblem ? reasonErrorId : undefined}>
          <legend className="mb-1.5 text-sm font-medium">
            {t.reason}
            <span aria-hidden="true" className="text-danger">
              {" "}
              *
            </span>
          </legend>
          {REPORT_REASONS.map((r, i) => (
            <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-control bg-surface px-3 has-[:checked]:border-accent">
              <input
                ref={i === 0 ? reasonRef : undefined}
                type="radio"
                name="reason"
                value={r}
                checked={reason === r}
                onChange={() => {
                  setReason(r);
                  setReasonProblem(undefined);
                }}
                className="size-4 accent-accent"
              />
              <span className="text-sm">{t.reasons[r]}</span>
            </label>
          ))}
          {reasonProblem && (
            <p id={reasonErrorId} className="text-xs font-medium text-danger">
              {reasonProblem}
            </p>
          )}
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={detailsId} className="text-sm font-medium">
            {t.details}
          </label>
          <textarea
            ref={detailsRef}
            id={detailsId}
            rows={4}
            value={details}
            aria-describedby={[`${detailsId}-count`, detailsProblem && `${detailsId}-error`].filter(Boolean).join(" ")}
            aria-invalid={detailsProblem || detailsLength > MAX_DETAILS ? true : undefined}
            onChange={(e) => {
              setDetails(e.target.value);
              setDetailsProblem(undefined);
            }}
            className="w-full rounded-md border border-control bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted aria-[invalid=true]:border-danger"
            placeholder={t.detailsPlaceholder}
          />
          <p id={`${detailsId}-count`} className={`text-xs ${detailsLength > MAX_DETAILS ? "font-medium text-danger" : "text-muted"}`}>
            {format(t.detailsCount, { count: detailsLength, max: MAX_DETAILS })}
          </p>
          {detailsProblem && (
            <p id={`${detailsId}-error`} className="text-xs font-medium text-danger">
              {detailsProblem}
            </p>
          )}
        </div>
        <Captcha
          config={captcha}
          locale={locale}
          labels={{ label: t.captchaLabel, loadFailed: t.captchaLoadFailed, retry: t.retry }}
          onToken={setToken}
          resetSignal={reset}
        />
        <FormAlert message={alert} />
        <Button type="submit" disabled={busy}>
          {busy ? t.working : t.submit}
        </Button>
      </form>
      <p className="text-xs text-pretty text-muted">{t.privacy}</p>
      {home}
    </>
  );
}
