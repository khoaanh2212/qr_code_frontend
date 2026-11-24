"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/text-field";
import { authFailure } from "@/features/auth/form-rules";
import { FormAlert } from "@/components/form/form-bits";
import { googleStartUrl } from "@/features/auth/google";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { redirectToLogin } from "@/features/auth/require-session";
import { ApiError } from "@/lib/api";
import { deleteAccount } from "./api";

import { Section } from "./section";

// Deleting the account: with the password, or confirmed with Google when there is none.

type T = Messages["account"];
type AuthT = Messages["auth"];

/** Back from the Google confirmation of a deletion (API reauth with this return path). */
const DELETE_CONFIRMED = "delete=confirm";
const REAUTH_FAILED = "google_reauth_failed";

/**
 * Irreversible: opened on purpose, no modal. Confirmed with the password, or, for an account
 * without one, by logging in to Google again (the API then allows the deletion for 5 minutes).
 */
export function DeleteAccount({ t, auth, locale, hasPassword }: { t: T; auth: AuthT; locale: Locale; hasPassword: boolean }) {
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
      await deleteAccount({});
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
      await deleteAccount({ password });
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
