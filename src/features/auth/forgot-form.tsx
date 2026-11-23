"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { format, localizePath, type Locale } from "@/i18n/config";
import { sessionApi } from "@/lib/api";
import { Captcha, type CaptchaConfig } from "./captcha";
import { FormAlert, Notice, ReturnToLink } from "./form-bits";
import { authFailure, emailError, type AuthMessages } from "./form-rules";
import { rememberEmail, useRememberedEmail } from "./remembered-email";

export function ForgotForm({ t, locale, captcha }: { t: AuthMessages; locale: Locale; captcha: CaptchaConfig }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const remembered = useRememberedEmail();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? remembered;
  const [emailProblem, setEmailProblem] = useState<string>();
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = emailError(email, t);
    setEmailProblem(problem);
    setAlert(undefined);
    if (problem) return emailRef.current?.focus();
    if (!token) return setAlert(t.errors.captchaRequired);

    setBusy(true);
    try {
      await sessionApi.request("/v1/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim(), captcha_token: token },
      });
      setSentTo(email.trim());
    } catch (err) {
      setAlert(authFailure(err, t).message);
    } finally {
      setBusy(false);
      setReset((n) => n + 1);
    }
  }

  const back = <ReturnToLink href={localizePath(locale, "/login")}>{t.backToLogin}</ReturnToLink>;

  if (sentTo) {
    return (
      <>
        <Notice tone="sent">
          <p>{format(t.forgotSent, { email: sentTo })}</p>
        </Notice>
        {back}
      </>
    );
  }

  return (
    <>
      <p className="-mt-2 text-sm text-pretty text-muted">{t.forgotIntro}</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          ref={emailRef}
          label={t.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          error={emailProblem}
          onChange={(e) => {
            setEmail(e.target.value);
            rememberEmail(e.target.value);
            setEmailProblem(undefined);
          }}
          onBlur={() => email && setEmailProblem(emailError(email, t))}
        />
        <Captcha
          config={captcha}
          locale={locale}
          labels={{ label: t.captchaLabel, loadFailed: t.captchaLoadFailed, retry: t.retry }}
          onToken={setToken}
          resetSignal={reset}
        />
        <FormAlert message={alert} />
        <Button type="submit" disabled={busy}>
          {busy ? t.working : t.forgotSubmit}
        </Button>
      </form>
      {back}
    </>
  );
}
