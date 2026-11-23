"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { localizePath, type Locale } from "@/i18n/config";
import { sessionApi } from "@/lib/api";
import { safeReturnTo } from "@/lib/navigation/return-to";
import { FormAlert, ReturnToLink } from "./form-bits";
import { authFailure, emailError, type AuthMessages } from "./form-rules";
import { rememberEmail, useRememberedEmail } from "./remembered-email";

/** Where to go after logging in: `return_to` when it is safe, else the dashboard. */
export function afterLoginTarget(locale: Locale): string {
  const fallback = localizePath(locale, "/app");
  return safeReturnTo(new URLSearchParams(window.location.search).get("return_to"), fallback);
}

type Errors = { email?: string; password?: string };

export function LoginForm({ t, locale }: { t: AuthMessages; locale: Locale }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const remembered = useRememberedEmail();
  const [typedEmail, setEmail] = useState<string | null>(null);
  const email = typedEmail ?? remembered;
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Back from the next page can restore this one from the back/forward cache, mid-"busy".
  useEffect(() => {
    const restore = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: Errors = { email: emailError(email, t), password: password === "" ? t.errors.required : undefined };
    setErrors(found);
    setAlert(undefined);
    if (found.email) return emailRef.current?.focus();
    if (found.password) return passwordRef.current?.focus();

    setBusy(true);
    try {
      await sessionApi.request("/v1/auth/login", { method: "POST", body: { email: email.trim(), password } });
      window.location.assign(afterLoginTarget(locale));
    } catch (err) {
      setAlert(authFailure(err, t).message);
      setBusy(false);
      passwordRef.current?.select();
    }
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
        autoComplete="current-password"
        required
        value={password}
        error={errors.password}
        showLabel={t.showPassword}
        onChange={(e) => {
          setPassword(e.target.value);
          setErrors((prev) => ({ ...prev, password: undefined }));
        }}
      />
      <div className="-my-2">
        <ReturnToLink href={localizePath(locale, "/forgot-password")}>{t.forgotLink}</ReturnToLink>
      </div>
      <FormAlert message={alert} />
      <Button type="submit" disabled={busy}>
        {busy ? t.working : t.loginSubmit}
      </Button>
    </form>
  );
}
