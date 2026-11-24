"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { authFailure, newPasswordError } from "@/features/auth/form-rules";
import { FormAlert, TextLink } from "@/features/auth/form-bits";
import { googleStartUrl } from "@/features/auth/google";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError, sessionApi } from "@/lib/api";
import type { Identity, MeResponse, User } from "@/lib/api/types";
import { SavedNote, Section } from "./section";

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
      await sessionApi.requestVoid("/v1/me/identities/google", { method: "DELETE" });
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

/** Back from the Google confirmation of a deletion (API reauth with this return path). */
const DELETE_CONFIRMED = "delete=confirm";
const REAUTH_FAILED = "google_reauth_failed";

/**
 * Irreversible: opened on purpose, no modal. Confirmed with the password, or, for an account
 * without one, by logging in to Google again (the API then allows the deletion for 5 minutes).
 */
function DeleteAccount({ t, auth, locale, hasPassword }: { t: T; auth: AuthT; locale: Locale; hasPassword: boolean }) {
  if (!hasPassword) return <DeleteWithGoogle t={t} auth={auth} locale={locale} />;
  return <DeleteWithPassword t={t} auth={auth} locale={locale} />;
}

// Rendered only in the browser: Security shows a placeholder until GET /v1/me has loaded, so
// reading window.location while initializing state is safe here.
function DeleteWithGoogle({ t, auth, locale }: { t: T; auth: AuthT; locale: Locale }) {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const returned = params.get("delete") === "confirm";
  const confirmRef = useRef<HTMLAnchorElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  // The return markers are one-shot: drop them so a reload or a later visit from history does
  // not claim a confirmation that has long expired.
  useEffect(() => {
    if (!params.has("delete") && !params.has("error")) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("delete");
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [params]);
  const [phase, setPhase] = useState<"closed" | "confirm" | "ready">(() =>
    returned ? (params.get("error") === REAUTH_FAILED ? "confirm" : "ready") : "closed",
  );
  const [alert, setAlert] = useState<string | undefined>(() =>
    returned && params.get("error") === REAUTH_FAILED ? t.deleteGoogleFailed : undefined,
  );
  const [busy, setBusy] = useState(false);
  const returnTo = `${localizePath(locale, "/app/account/security")}?${DELETE_CONFIRMED}`;

  // Each step replaces the control that had focus: move it to the next step's control.
  useEffect(() => {
    if (!moved.current) return;
    if (phase === "confirm") confirmRef.current?.focus();
    else if (phase === "ready") deleteRef.current?.focus();
    else triggerRef.current?.focus();
  }, [phase]);
  const go = (next: typeof phase) => {
    moved.current = true;
    setPhase(next);
  };

  async function remove() {
    if (busy) return;
    setBusy(true);
    setAlert(undefined);
    try {
      await sessionApi.requestVoid("/v1/me", { method: "DELETE", body: {} });
      window.location.assign(localizePath(locale, "/"));
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (err instanceof ApiError && err.code === "google_reauth_required") {
        setAlert(t.deleteGoogleExpired);
        go("confirm");
      } else if (err instanceof ApiError && err.code === "last_admin") setAlert(t.lastAdmin);
      else setAlert(authFailure(err, auth).message);
    }
  }

  return (
    <Section title={t.deleteTitle} description={t.deleteIntro} danger>
      {phase === "closed" && <DeleteTrigger ref={triggerRef} label={t.deleteStart} onClick={() => go("confirm")} />}
      {phase === "confirm" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-pretty">{t.deleteGoogleIntro}</p>
          <FormAlert message={alert} />
          <div className="flex flex-wrap gap-3">
            <a
              ref={confirmRef}
              href={googleStartUrl({ returnTo, reauth: true })}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-control px-4 text-sm font-semibold hover:bg-foreground/5"
            >
              {t.deleteWithGoogle}
            </a>
            <Button variant="secondary" onClick={() => go("closed")}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
      {phase === "ready" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-pretty">{t.deleteGoogleReady}</p>
          <FormAlert message={alert} />
          <div className="flex flex-wrap gap-3">
            <Button ref={deleteRef} variant="danger" busy={busy} onClick={remove}>
              {busy ? auth.working : t.deleteSubmit}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => go("closed")}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

/** A quiet trigger, like the reference's "close my account" link; the red is for the final step. */
function DeleteTrigger({ label, onClick, ref }: { label: string; onClick: () => void; ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-fit items-center text-sm text-muted underline underline-offset-4 hover:text-danger"
    >
      {label}
    </button>
  );
}

function DeleteWithPassword({ t, auth, locale }: { t: T; auth: AuthT; locale: Locale }) {
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
        <DeleteTrigger ref={openRef} label={t.deleteStart} onClick={() => setOpen(true)} />
      )}
    </Section>
  );
}
