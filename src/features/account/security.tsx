"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { authFailure, newPasswordError } from "@/features/auth/form-rules";
import { FormAlert } from "@/features/auth/form-bits";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError, sessionApi } from "@/lib/api";
import { SavedNote, Section } from "./section";

type T = Messages["account"];
type AuthT = Messages["auth"];

export function Security({ t, auth, locale }: { t: T; auth: AuthT; locale: Locale }) {
  return (
    <>
      <ChangePassword t={t} auth={auth} />
      <DeleteAccount t={t} auth={auth} locale={locale} />
    </>
  );
}

type Errors = { current?: string; next?: string };

function ChangePassword({ t, auth }: { t: T; auth: AuthT }) {
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string>();
  const [done, setDone] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found: Errors = {
      current: current === "" ? auth.errors.required : undefined,
      next: newPasswordError(next, auth),
    };
    setErrors(found);
    setAlert(undefined);
    setDone(undefined);
    if (found.current) return currentRef.current?.focus();
    if (found.next) return nextRef.current?.focus();

    setBusy(true);
    try {
      await sessionApi.requestVoid("/v1/me/password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      setCurrent("");
      setNext("");
      setDone(t.passwordChanged);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (err instanceof ApiError && err.field === "current_password") {
        setErrors({ current: t.currentWrong });
        currentRef.current?.select();
      } else if (err instanceof ApiError && err.field === "new_password") {
        setErrors({ next: auth.errors.passwordShort });
        nextRef.current?.focus();
      } else setAlert(authFailure(err, auth).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.passwordTitle}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          ref={currentRef}
          label={t.currentPassword}
          autoComplete="current-password"
          required
          value={current}
          error={errors.current}
          showLabel={auth.showPassword}
          onChange={(e) => {
            setCurrent(e.target.value);
            setErrors((prev) => ({ ...prev, current: undefined }));
          }}
        />
        <PasswordField
          ref={nextRef}
          label={t.newPassword}
          autoComplete="new-password"
          required
          minLength={10}
          value={next}
          help={auth.passwordHelp}
          error={errors.next}
          showLabel={auth.showPassword}
          onChange={(e) => {
            setNext(e.target.value);
            setErrors((prev) => ({ ...prev, next: undefined }));
          }}
          onBlur={() => next && setErrors((prev) => ({ ...prev, next: newPasswordError(next, auth) }))}
        />
        <FormAlert message={alert} />
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="secondary" busy={busy}>
            {busy ? auth.working : t.passwordSubmit}
          </Button>
          <SavedNote message={done} />
        </div>
      </form>
    </Section>
  );
}

/** Irreversible: opened on purpose, confirmed with the password, no modal. */
function DeleteAccount({ t, auth, locale }: { t: T; auth: AuthT; locale: Locale }) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);

  // Cancel removes the form under the user's focus: return it to the button that opened it.
  useEffect(() => {
    if (!open && wasOpen.current) openRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setAlert(undefined);
    if (password === "") {
      setError(auth.errors.required);
      return passwordRef.current?.focus();
    }
    setBusy(true);
    try {
      await sessionApi.requestVoid("/v1/me", { method: "DELETE", body: { password } });
      window.location.assign(localizePath(locale, "/"));
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (err instanceof ApiError && err.code === "last_admin") setAlert(t.lastAdmin);
      else if (err instanceof ApiError && err.status === 422 && err.field === "password") {
        setError(t.currentWrong);
        passwordRef.current?.select();
      } else setAlert(authFailure(err, auth).message);
    }
  }

  return (
    <Section title={t.deleteTitle} description={t.deleteIntro} danger>
      {open ? (
        <form
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) {
              e.preventDefault();
              setOpen(false);
              setPassword("");
              setError(undefined);
              setAlert(undefined);
            }
          }}
          className="flex flex-col gap-4"
        >
          <PasswordField
            ref={passwordRef}
            label={t.deleteConfirm}
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            error={error}
            showLabel={auth.showPassword}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
          />
          <FormAlert message={alert} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" busy={busy}>
              {busy ? auth.working : t.deleteSubmit}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(undefined);
                setAlert(undefined);
              }}
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        // A quiet trigger, like the reference's "close my account" link; the red is for the final step.
        <button
          ref={openRef}
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 w-fit items-center text-sm text-muted underline underline-offset-4 hover:text-danger"
        >
          {t.deleteStart}
        </button>
      )}
    </Section>
  );
}
