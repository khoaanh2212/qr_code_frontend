"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { format, localizePath, type Locale } from "@/i18n/config";
import { sessionApi } from "@/lib/api";
import { Captcha, type CaptchaConfig } from "./captcha";
import { FormAlert, Notice, TextLink, withReturnTo } from "./form-bits";
import { authFailure, emailError, newPasswordError, type AuthMessages } from "./form-rules";
import { ResendForm } from "./resend-form";

type Errors = { email?: string; password?: string; display_name?: string };

export function RegisterForm({ t, locale, captcha }: { t: AuthMessages; locale: Locale; captcha: CaptchaConfig }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      await sessionApi.request("/v1/auth/register", { method: "POST", body });
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
      <div className="flex flex-col gap-6">
        <Notice title={t.checkEmailTitle}>
          <p>{format(t.checkEmailBody, { email: sentTo })}</p>
          <p className="text-muted">{t.checkEmailHint}</p>
        </Notice>
        <ResendForm t={t} locale={locale} captcha={captcha} initialEmail={sentTo} askEmail={false} />
        <TextLink href={withReturnTo(localizePath(locale, "/login"))}>{t.toLogin}</TextLink>
      </div>
    );
  }

  return (
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
        onChange={(e) => setEmail(e.target.value)}
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
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        ref={nameRef}
        label={t.displayName}
        autoComplete="name"
        maxLength={100}
        value={name}
        help={t.displayNameHelp}
        error={errors.display_name}
        onChange={(e) => setName(e.target.value)}
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
  );
}
