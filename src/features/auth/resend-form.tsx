"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { Locale } from "@/i18n/config";
import { sessionApi } from "@/lib/api";
import { Captcha, type CaptchaConfig } from "./captcha";
import { FormAlert } from "./form-bits";
import { authFailure, emailError, type AuthMessages } from "./form-rules";

/** Asks for a new verification link. Always answered the same way, whatever the address. */
export function ResendForm({
  t,
  locale,
  captcha,
  initialEmail = "",
  askEmail = true,
}: {
  t: AuthMessages;
  locale: Locale;
  captcha: CaptchaConfig;
  initialEmail?: string;
  askEmail?: boolean;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [emailProblem, setEmailProblem] = useState<string>();
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [alert, setAlert] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = emailError(email, t);
    setEmailProblem(problem);
    setAlert(undefined);
    if (problem) return emailRef.current?.focus();
    if (!token) return setAlert(t.errors.captchaRequired);

    setBusy(true);
    try {
      await sessionApi.request("/v1/auth/resend-verification", {
        method: "POST",
        body: { email: email.trim(), captcha_token: token },
      });
      setSent(true);
    } catch (err) {
      setAlert(authFailure(err, t).message);
    } finally {
      setBusy(false);
      setReset((n) => n + 1);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {askEmail && (
        <TextField
          ref={emailRef}
          label={t.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          error={emailProblem}
          onChange={(e) => setEmail(e.target.value)}
        />
      )}
      <Captcha
        config={captcha}
        locale={locale}
        labels={{ label: t.captchaLabel, loadFailed: t.captchaLoadFailed, retry: t.retry }}
        onToken={setToken}
        resetSignal={reset}
      />
      <FormAlert message={alert} />
      <p role="status" className="text-sm text-muted empty:hidden">
        {sent ? t.resent : ""}
      </p>
      <Button type="submit" variant={askEmail ? "primary" : "secondary"} disabled={busy}>
        {busy ? t.working : t.resendSubmit}
      </Button>
    </form>
  );
}
