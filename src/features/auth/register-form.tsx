"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { format, localizePath, type Locale } from "@/i18n/config";
import { register } from "./api";
import { Captcha, type CaptchaConfig } from "./captcha";
import { GoogleSignIn } from "./google";
import { FormAlert, Notice, ReturnToLink } from "@/components/form/form-bits";
import { authFailure, emailError, newPasswordError, type AuthMessages } from "./form-rules";
import { rememberEmail, useRememberedEmail } from "./remembered-email";
import { ResendForm } from "./resend-form";

type Errors = { email?: string; password?: string; display_name?: string };

/** Sign-up: owns the page heading, which becomes "Check your email" once the form is sent. */
export function RegisterForm({ t, locale, captcha }: { t: AuthMessages; locale: Locale; captcha: CaptchaConfig }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const remembered = useRememberedEmail();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? remembered;
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendOpen, setResendOpen] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = { email: emailError(email, t), password: newPasswordError(password, t) };
    setErrors(found);
    setAlert(undefined);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();
    if (!token) return setAlert(t.errors.captchaRequired);

    setBusy(true);
    try {
      const body: Record<string, string> = { email: email.trim(), password, captcha_token: token };
      if (name.trim()) body.display_name = name.trim();
      await register(body);
      setSentTo(email.trim());
    } catch (err) {
      const failure = authFailure(err, t);
      if (failure.field) setErrors({ [failure.field]: failure.message });
      else setAlert(failure.message);
      if (failure.field === "email") emailRef.current?.focus();
      if (failure.field === "password") passwordRef.current?.focus();
      if (failure.field === "display_name") nameRef.current?.focus();
    } finally {
      setBusy(false);
      setReset((n) => n + 1);
    }
  }

  if (sentTo) {
    return (
      <>
        <h1 className="text-2xl font-semibold">{t.checkEmailTitle}</h1>
        <Notice tone="sent">
          <p>{format(t.checkEmailBody, { email: sentTo })}</p>
        </Notice>
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" aria-expanded={resendOpen} onClick={() => setResendOpen((v) => !v)}>
            {t.didntGetIt}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSentTo(null);
              setResendOpen(false);
              setPassword("");
            }}
          >
            {t.useDifferentEmail}
          </Button>
        </div>
        {/* The resend check (and its captcha) only loads once someone says the email did not come. */}
        {resendOpen && (
          <div className="flex flex-col gap-3 border-t border-border pt-5">
            <p className="text-sm text-pretty text-muted">{t.checkEmailHint}</p>
            <ResendForm t={t} locale={locale} captcha={captcha} fixedEmail={sentTo} />
          </div>
        )}
        <ReturnToLink href={localizePath(locale, "/login")}>{t.toLogin}</ReturnToLink>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t.registerTitle}</h1>
        <p className="text-sm text-pretty text-muted">{t.registerIntro}</p>
      </div>
      <GoogleSignIn t={t} locale={locale} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          ref={emailRef}
          label={t.email}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            rememberEmail(e.target.value);
            setErrors((prev) => ({ ...prev, email: undefined }));
          }}
          onBlur={() => email && setErrors((prev) => ({ ...prev, email: emailError(email, t) }))}
        />
        <PasswordField
          ref={passwordRef}
          label={t.password}
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          help={t.passwordHelp}
          error={errors.password}
          showLabel={t.showPassword}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          onBlur={() => password && setErrors((prev) => ({ ...prev, password: newPasswordError(password, t) }))}
        />
        <TextField
          ref={nameRef}
          label={t.displayName}
          autoComplete="name"
          maxLength={100}
          value={name}
          help={t.displayNameHelp}
          error={errors.display_name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, display_name: undefined }));
          }}
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
          {busy ? t.working : t.registerSubmit}
        </Button>
      </form>
      <ReturnToLink href={localizePath(locale, "/login")}>{t.toLogin}</ReturnToLink>
    </>
  );
}
