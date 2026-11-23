"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { redirectToLogin, useSetUser, useUser } from "@/features/auth/require-session";
import type { CaptchaConfig } from "@/features/auth/captcha";
import { authFailure } from "@/features/auth/form-rules";
import { FormAlert } from "@/features/auth/form-bits";
import { ResendForm } from "@/features/auth/resend-form";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError, sessionApi } from "@/lib/api";
import type { MeResponse } from "@/lib/api/types";
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
          <dd className="flex items-center gap-1.5 font-medium">
            {user.email_verified ? (
              <>
                <CircleCheck aria-hidden="true" className="size-4 text-accent" />
                {t.verified}
              </>
            ) : (
              <>
                <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
                {t.unverified}
              </>
            )}
          </dd>
          <dt className="text-muted">{t.memberSince}</dt>
          <dd className="font-medium">{formatDate(user.created_at, locale)}</dd>
        </dl>
        {!user.email_verified && <VerifyBanner t={t} auth={auth} locale={locale} captcha={captcha} email={user.email} />}
      </Section>
      <DisplayNameForm t={t} auth={auth} />
    </>
  );
}

/** Unverified address: says so, and offers a new link (the captcha loads only when asked). */
function VerifyBanner({ t, auth, locale, captcha, email }: { t: T; auth: AuthT; locale: Locale; captcha: CaptchaConfig; email: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  // The button that opened the form is gone: continue from the form.
  useEffect(() => {
    if (open) formRef.current?.focus();
  }, [open]);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/50 bg-surface p-4">
      <p className="flex gap-2 text-sm text-pretty">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
        {t.unverifiedBanner}
      </p>
      {open ? (
        <div ref={formRef} tabIndex={-1} className="outline-none">
          <ResendForm t={auth} locale={locale} captcha={captcha} fixedEmail={email} />
        </div>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          {auth.resendSubmit}
        </Button>
      )}
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
      const res = await sessionApi.request<MeResponse>("/v1/me", { method: "PATCH", body: { display_name: name.trim() } });
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
