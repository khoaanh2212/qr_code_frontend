"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { localizePath, type Locale } from "@/i18n/config";
import { ApiError, sessionApi } from "@/lib/api";
import { ButtonLink, FormAlert, Notice, TextLink } from "./form-bits";
import { authFailure, newPasswordError, type AuthMessages } from "./form-rules";
import { useFragmentToken } from "./fragment-token";

export function ResetForm({ t, locale }: { t: AuthMessages; locale: Locale }) {
  const link = useFragmentToken();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string>();
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"done" | "invalid" | null>(null);

  const requestNew = <TextLink href={localizePath(locale, "/forgot-password")}>{t.requestNewReset}</TextLink>;

  if (link.kind === "reading") return null;
  if (link.kind === "missing") {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="warning">
          <p>{t.tokenMissing}</p>
        </Notice>
        {requestNew}
      </div>
    );
  }
  if (outcome === "done") {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="success">
          <p>{t.resetDone}</p>
        </Notice>
        <ButtonLink href={localizePath(locale, "/login")}>{t.loginSubmit}</ButtonLink>
      </div>
    );
  }
  if (outcome === "invalid") {
    return (
      <div className="flex flex-col gap-6">
        <Notice tone="warning">
          <p>{t.resetInvalid}</p>
        </Notice>
        {requestNew}
      </div>
    );
  }

  const token = link.token;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = newPasswordError(password, t);
    setProblem(found);
    setAlert(undefined);
    if (found) return passwordRef.current?.focus();

    setBusy(true);
    try {
      await sessionApi.request("/v1/auth/reset-password", { method: "POST", body: { token, password } });
      setOutcome("done");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_token") setOutcome("invalid");
      else {
        const failure = authFailure(err, t);
        if (failure.field === "password") {
          setProblem(failure.message);
          passwordRef.current?.focus();
        } else setAlert(failure.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-pretty text-muted">{t.resetIntro}</p>
      <PasswordField
        ref={passwordRef}
        label={t.newPassword}
        autoComplete="new-password"
        required
        minLength={10}
        value={password}
        help={t.passwordHelp}
        error={problem}
        showLabel={t.showPassword}
        onChange={(e) => {
          setPassword(e.target.value);
          setProblem(undefined);
        }}
        onBlur={() => password && setProblem(newPasswordError(password, t))}
      />
      <FormAlert message={alert} />
      <Button type="submit" disabled={busy}>
        {busy ? t.working : t.resetSubmit}
      </Button>
      <TextLink href={localizePath(locale, "/login")}>{t.backToLogin}</TextLink>
    </form>
  );
}
