"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { authFailure, newPasswordError } from "@/features/auth/form-rules";
import { FormAlert, TextLink } from "@/components/form/form-bits";

import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError, sessionApi } from "@/lib/api";
import { changePassword, unlinkGoogle } from "./api";
import type { Identity, MeResponse, User } from "@/lib/api/types";
import { SavedNote, Section } from "./section";
import { DeleteAccount } from "./delete-account";

type T = Messages["account"];
type AuthT = Messages["auth"];

type Me = { user: User; identities: Identity[] };

/** Loads the account with its login methods; GET /v1/me is the only source of both. */
function useMe(): [Me | null, (next: Me) => void, boolean] {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    sessionApi
      .request<MeResponse>("/v1/me", { signal: abort.signal })
      .then((res) => setMe({ user: res.user, identities: res.identities ?? [] }))
      .catch((err) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setFailed(true);
      });
    return () => abort.abort();
  }, []);
  return [me, setMe, failed];
}

export function Security({ t, auth, locale }: { t: T; auth: AuthT; locale: Locale }) {
  const [me, setMe, failed] = useMe();
  if (failed) return <FormAlert message={auth.errors.generic} />;
  if (!me) return <p role="status" className="text-sm text-muted">{auth.working}</p>;
  const hasPassword = me.user.has_password;
  return (
    <>
      <LoginMethods t={t} auth={auth} me={me} onChange={setMe} />
      {hasPassword ? (
        <ChangePassword t={t} auth={auth} />
      ) : (
        <Section title={t.methodPassword}>
          <p className="text-sm text-pretty text-muted">{t.noPasswordYet}</p>
          <TextLink href={localizePath(locale, "/forgot-password")}>{t.setPasswordLink}</TextLink>
        </Section>
      )}
      <DeleteAccount t={t} auth={auth} locale={locale} hasPassword={hasPassword} />
    </>
  );
}

/** Password and Google: which ones the account has, and unlinking Google while a password remains. */
function LoginMethods({ t, auth, me, onChange }: { t: T; auth: AuthT; me: Me; onChange: (next: Me) => void }) {
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string>();
  const [done, setDone] = useState<string>();
  const resultRef = useRef<HTMLDivElement>(null);
  const google = me.identities.find((i) => i.provider === "google");
  // The unlink button disappears with the link: keep keyboard users next to the result.
  useEffect(() => {
    if (done) resultRef.current?.focus();
  }, [done]);

  async function unlink() {
    if (busy) return;
    setBusy(true);
    setAlert(undefined);
    try {
      await unlinkGoogle();
      onChange({ ...me, identities: me.identities.filter((i) => i.provider !== "google") });
      setDone(t.googleUnlinked);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (err instanceof ApiError && err.code === "last_login_method") setAlert(t.unlinkLastMethod);
      else if (err instanceof ApiError && err.status === 404) {
        onChange({ ...me, identities: [] });
        setDone(t.googleNotLinked);
      }
      else setAlert(authFailure(err, auth).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t.methodsTitle}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted">{t.methodPassword}</dt>
        <dd className="flex flex-col items-start gap-1">
          <span className="font-medium">{me.user.has_password ? t.passwordSet : t.passwordNotSet}</span>
        </dd>
        <dt className="text-muted">{t.methodGoogle}</dt>
        <dd className="flex flex-col items-start gap-2">
          <span className="font-medium break-all">{google ? format(t.googleLinked, { email: google.email }) : t.googleNotLinked}</span>
          {google &&
            (me.user.has_password ? (
              <Button variant="secondary" busy={busy} onClick={unlink}>
                {busy ? auth.working : t.unlinkGoogle}
              </Button>
            ) : (
              <p className="text-pretty text-muted">{t.unlinkLastMethod}</p>
            ))}
        </dd>
      </dl>
      <div ref={resultRef} tabIndex={-1} className="outline-none">
        <FormAlert message={alert} />
        <SavedNote message={done} />
      </div>
    </Section>
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
      await changePassword({ current_password: current, new_password: next });
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

