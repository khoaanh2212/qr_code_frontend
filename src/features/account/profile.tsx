"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { redirectToLogin, useSetUser, useUser } from "@/features/auth/require-session";
import type { CaptchaConfig } from "@/features/auth/captcha";
import { authFailure } from "@/features/auth/form-rules";
import { FormAlert } from "@/components/form/form-bits";
import { Captcha } from "@/features/auth/captcha";
import { format, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { resendVerification } from "@/features/auth/api";
import { updateProfile } from "./api";
import { formatDate } from "@/lib/format/time";
import { SavedNote, Section } from "./section";

type T = Messages["account"];
type AuthT = Messages["auth"];

export function Profile({ t, auth, locale, captcha }: { t: T; auth: AuthT; locale: Locale; captcha: CaptchaConfig }) {
  const user = useUser();
  return (
    <>
      <Section title={t.infoTitle}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted">{t.email}</dt>
          <dd className="font-medium break-all">{user.email}</dd>
          <dt className="text-muted">{t.status}</dt>
          <dd className="flex flex-col gap-2">
            {user.email_verified ? (
              <span className="flex items-center gap-1.5 font-medium">
                <CircleCheck aria-hidden="true" className="size-4 text-accent" />
                {t.verified}
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-medium">
                  <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
                  {t.unverified}
                </span>
                <ResendInline t={t} auth={auth} locale={locale} captcha={captcha} email={user.email} />
              </>
            )}
          </dd>
          <dt className="text-muted">{t.memberSince}</dt>
          <dd className="font-medium">{formatDate(user.created_at, locale)}</dd>
        </dl>
      </Section>
      <DisplayNameForm t={t} auth={auth} />
    </>
  );
}

/**
 * Unverified address, in the status line: one click sends a new link. With Turnstile on, the
 * check appears inline and the request goes out as soon as it passes.
 */
function ResendInline({ t, auth, locale, captcha, email }: { t: T; auth: AuthT; locale: Locale; captcha: CaptchaConfig; email: string }) {
  const [phase, setPhase] = useState<"idle" | "checking" | "sending" | "sent">("idle");
  const [alert, setAlert] = useState<string>();
  const [reset, setReset] = useState(0);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });

  async function send(token: string) {
    setPhase("sending");
    setAlert(undefined);
    try {
      await resendVerification({ email, captcha_token: token });
      setPhase("sent");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setAlert(authFailure(err, auth).message);
      setPhase("idle");
      setReset((n) => n + 1);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-pretty text-muted">{t.unverifiedBanner}</p>
      {phase === "idle" && (
        <button
          type="button"
          onClick={() => {
            setAlert(undefined);
            if (captcha.devToken && !captcha.siteKey) void send(captcha.devToken);
            else setPhase("checking");
          }}
          className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          {t.sendNewLink}
        </button>
      )}
      {(phase === "checking" || phase === "sending") && captcha.siteKey && (
        <Captcha
          config={captcha}
          locale={locale}
          labels={{ label: auth.captchaLabel, loadFailed: auth.captchaLoadFailed, retry: auth.retry }}
          resetSignal={reset}
          onToken={(token) => {
            if (token && phaseRef.current === "checking") void send(token);
          }}
        />
      )}
      {phase === "sending" && <p className="text-sm text-muted">{auth.working}</p>}
      <p role="status" className="text-sm text-pretty">
        {phase === "sent" ? format(t.linkSent, { email }) : ""}
      </p>
      <FormAlert message={alert} />
    </div>
  );
}

function DisplayNameForm({ t, auth }: { t: T; auth: AuthT }) {
  const user = useUser();
  const setUser = useSetUser();
  const [name, setName] = useState(user.display_name);
  const [error, setError] = useState<string>();
  const [alert, setAlert] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [busy, setBusy] = useState(false);
  const unchanged = name.trim() === user.display_name;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || unchanged) return;
    setAlert(undefined);
    setSaved(undefined);
    setBusy(true);
    try {
      const res = await updateProfile({ display_name: name.trim() });
      setUser(res.user);
      setName(res.user.display_name);
      setSaved(t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const failure = authFailure(err, auth);
      if (failure.field === "display_name") setError(failure.message);
      else setAlert(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.nameTitle} description={t.nameHelp}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t.nameLabel}
          autoComplete="name"
          maxLength={100}
          value={name}
          error={error}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
            setSaved(undefined);
          }}
        />
        <FormAlert message={alert} />
        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" busy={busy} disabled={unchanged && !busy}>
            {busy ? t.saving : t.save}
          </Button>
          <SavedNote message={saved} />
        </div>
      </form>
    </Section>
  );
}
