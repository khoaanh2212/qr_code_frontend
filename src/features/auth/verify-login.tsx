"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ButtonLink, FormAlert, Notice, ReturnToLink, withReturnTo } from "@/components/form/form-bits";
import { localizePath, type Locale } from "@/i18n/config";
import { ApiError, commonErrorMessage, toApiError } from "@/lib/api";
import type { MfaLoginStep, MfaMethod, WebAuthnOptions } from "@/lib/api/types";
import { getPasskeyAssertion, passkeyFailureKind, passkeysSupported } from "@/lib/browser/webauthn";
import { finishLogin, passkeyLoginOptions, pendingLogin } from "./api";
import type { AuthMessages } from "./form-rules";
import { afterLoginTarget } from "./login-form";

type Phase =
  | { kind: "loading" }
  | { kind: "failed"; error: ApiError }
  | { kind: "expired" }
  | { kind: "ready"; methods: MfaMethod[] };

/** The methods this page knows, in the API's order. */
const KNOWN: readonly MfaMethod[] = ["totp", "passkey", "recovery_code"];

/**
 * A Retry-After this long is the per-account limit on failed second steps (one hour,
 * mfaFailureWindow in the backend's service/mfa_login.go), not the short per-IP one.
 */
const ACCOUNT_LIMIT_SECONDS = 600;

/** The method shown first: the authenticator app when the account has one. */
function firstMethod(methods: MfaMethod[]): MfaMethod {
  return methods.includes("totp") ? "totp" : methods[0]!;
}

/**
 * The second login step (/login/verify), after a right password or a Google login on an account
 * with two-step verification. The methods come from the pending login itself, so the page also
 * works after the Google redirect and after a reload.
 */
export function VerifyLogin({ t, locale }: { t: AuthMessages; locale: Locale }) {
  const v = t.verify;
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [method, setMethod] = useState<MfaMethod>("totp");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const passkeyRef = useRef<HTMLButtonElement>(null);
  const otherWaysId = useId();

  // Bumped by "Try again" to read the status once more.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let ignore = false;
    pendingLogin()
      .then(({ methods }) => {
        if (ignore) return;
        const known = KNOWN.filter((m) => methods.includes(m));
        if (known.length === 0) return setPhase({ kind: "failed", error: new ApiError(0, "unknown_methods", "") });
        setMethod(firstMethod(known));
        setPhase({ kind: "ready", methods: known });
      })
      .catch((err) => {
        if (ignore) return;
        const e = toApiError(err);
        setPhase(e.code === "mfa_login_expired" ? { kind: "expired" } : { kind: "failed", error: e });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);

  // Back from the next page can restore this one from the back/forward cache, mid-"busy".
  useEffect(() => {
    const restore = (e: PageTransitionEvent) => e.persisted && setBusy(false);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  // Switching methods moves focus to the new method's control (after it is rendered).
  const [switches, setSwitches] = useState(0);
  useEffect(() => {
    if (switches === 0) return;
    (method === "passkey" ? passkeyRef.current : inputRef.current)?.focus();
  }, [switches, method]);

  /** The message for a refused or failed step. Side effect: an expired login ends the page. */
  function failure(err: unknown, refused: string): string | undefined {
    const e = toApiError(err);
    if (e.code === "mfa_login_expired") {
      setPhase({ kind: "expired" });
      return undefined;
    }
    if (e.code === "rate_limited" && (e.retryAfter ?? 0) >= ACCOUNT_LIMIT_SECONDS) return v.tooManyTries;
    if (e.code === "invalid_mfa_code") return refused;
    return commonErrorMessage(e, t.errors) ?? t.errors.generic;
  }

  /**
   * After a lost answer, whether the step went through: a right step uses the pending login up,
   * so an expired status means the session is open (or the login really expired, and the session
   * guard sends the person back to log in).
   */
  async function stepWentThrough(): Promise<boolean> {
    try {
      await pendingLogin();
      return false;
    } catch (err) {
      return toApiError(err).code === "mfa_login_expired";
    }
  }

  async function finish(step: MfaLoginStep, refused: string) {
    try {
      await finishLogin(step);
      window.location.assign(afterLoginTarget(locale));
      return;
    } catch (err) {
      if (toApiError(err).code === "network_error" && (await stepWentThrough())) {
        window.location.assign(afterLoginTarget(locale));
        return;
      }
      setAlert(failure(err, refused));
      setBusy(false);
      if (step.method === "passkey") passkeyRef.current?.focus();
      else inputRef.current?.select();
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setAlert(undefined);
    if (method === "totp") {
      const digits = code.replace(/[\s -]/g, "");
      if (!/^\d{6}$/.test(digits)) {
        setFieldError(v.codeInvalid);
        return inputRef.current?.focus();
      }
      setBusy(true);
      return finish({ method: "totp", code: digits }, v.codeRefused);
    }
    const recovery = code.trim();
    if (recovery === "") {
      setFieldError(t.errors.required);
      return inputRef.current?.focus();
    }
    setBusy(true);
    return finish({ method: "recovery_code", code: recovery }, v.recoveryRefused);
  }

  async function signInWithPasskey() {
    if (busy) return;
    setAlert(undefined);
    setBusy(true);
    let options: WebAuthnOptions;
    try {
      ({ passkey: options } = await passkeyLoginOptions());
    } catch (err) {
      setAlert(failure(err, v.passkeyRefused));
      setBusy(false);
      return passkeyRef.current?.focus();
    }
    try {
      const assertion = await getPasskeyAssertion(options);
      return finish({ method: "passkey", assertion }, v.passkeyRefused);
    } catch (err) {
      // Nothing reached the server: the login is untouched.
      setAlert(passkeyFailureKind(err) === "cancelled" ? v.passkeyCancelled : v.passkeyFailed);
      setBusy(false);
      return passkeyRef.current?.focus();
    }
  }

  function switchTo(next: MfaMethod) {
    setMethod(next);
    setCode("");
    setFieldError(undefined);
    setAlert(undefined);
    setSwitches((n) => n + 1);
  }

  if (phase.kind === "loading") {
    return (
      <p role="status" className="text-sm text-muted">
        {v.loading}
      </p>
    );
  }
  if (phase.kind === "failed") {
    return (
      <Notice tone="danger">
        <p>{commonErrorMessage(phase.error, t.errors) ?? t.errors.generic}</p>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setPhase({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            {t.retry}
          </Button>
        </div>
      </Notice>
    );
  }
  if (phase.kind === "expired") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="warning">
          <p>{v.expired}</p>
        </Notice>
        <ButtonLink href={withReturnTo(localizePath(locale, "/login"))}>{v.startAgain}</ButtonLink>
      </div>
    );
  }

  const otherLabel: Record<MfaMethod, string> = {
    totp: v.useAppInstead,
    passkey: v.usePasskeyInstead,
    recovery_code: v.useRecoveryInstead,
  };
  const others = phase.methods.filter((m) => m !== method);

  return (
    <div className="flex flex-col gap-6">
      {method === "passkey" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-pretty text-muted">{v.introPasskey}</p>
          {passkeysSupported() ? (
            <>
              <FormAlert message={alert} />
              <Button ref={passkeyRef} autoFocus busy={busy} onClick={() => void signInWithPasskey()}>
                {busy ? t.working : v.passkeySubmit}
              </Button>
            </>
          ) : (
            <Notice tone="warning">
              <p>{v.passkeyUnsupported}</p>
            </Notice>
          )}
        </div>
      ) : (
        <form noValidate onSubmit={submitCode} className="flex flex-col gap-4">
          <p className="text-sm text-pretty text-muted">{method === "totp" ? v.introApp : v.introRecovery}</p>
          <TextField
            key={method}
            ref={inputRef}
            label={method === "totp" ? v.codeLabel : v.recoveryLabel}
            autoComplete={method === "totp" ? "one-time-code" : "off"}
            inputMode={method === "totp" ? "numeric" : "text"}
            autoCapitalize="none"
            autoFocus
            aria-required="true"
            maxLength={method === "totp" ? 12 : 64}
            spellCheck={false}
            className={method === "totp" ? "font-mono tabular-nums tracking-widest" : "font-mono"}
            value={code}
            error={fieldError}
            onChange={(e) => {
              setCode(e.target.value);
              setFieldError(undefined);
            }}
          />
          <FormAlert message={alert} />
          <Button type="submit" busy={busy}>
            {busy ? t.working : v.submit}
          </Button>
        </form>
      )}

      {others.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-4">
          <h2 id={otherWaysId} className="text-sm font-medium text-muted">
            {v.otherWays}
          </h2>
          <ul aria-labelledby={otherWaysId} className="flex flex-col">
            {others.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => switchTo(m)}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {otherLabel[m]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ReturnToLink href={localizePath(locale, "/login")}>{t.backToLogin}</ReturnToLink>
    </div>
  );
}
