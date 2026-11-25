"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { PasswordField, TextField } from "@/components/ui/text-field";
import { FormAlert } from "@/components/form/form-bits";
import { googleStartUrl } from "@/features/auth/google";
import { redirectToLogin } from "@/features/auth/require-session";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { commonErrorMessage, toApiError } from "@/lib/api";
import type { AccountPasskey, MfaStatus, TotpSetup } from "@/lib/api/types";
import { saveBlob } from "@/lib/browser/download";
import { createPasskey, passkeyFailureKind, passkeysSupported } from "@/lib/browser/webauthn";
import {
  addPasskey,
  beginTotp,
  confirmTotp,
  mfaStatus,
  passkeyCreationOptions,
  reauth,
  regenerateRecoveryCodes,
  removePasskey,
  removeTotp,
  totpQrCode,
} from "./mfa-api";
import { SavedNote, Section } from "./section";

type T = Messages["account"];
type AuthT = Messages["auth"];

/** Back from the Google confirmation (API reauth with this return path). */
const GOOGLE_CONFIRMED = "two_step=confirm";

type Panel = { kind: "none" } | { kind: "totp"; setup: TotpSetup } | { kind: "passkey" };
type Dialog = { kind: "removeApp" } | { kind: "removePasskey"; key: AccountPasskey } | { kind: "regenerate" } | { kind: "turnOff" };

/** A change; failures it explains itself go to `onError`, the others are thrown. */
type Change = (onError: (message: string) => void) => Promise<void>;

/** The base32 secret in groups of four, easier to type by hand. */
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, "$1 ");
}

/** The factor (or the whole 2FA) is already gone: removed in another tab or on another device. */
function alreadyGone(err: unknown): boolean {
  const code = toApiError(err).code;
  return code === "not_found" || code === "mfa_not_enabled";
}

/**
 * Two-step verification on the security page (backend PLAN items 30 and 33): turn it on with an
 * authenticator app or a passkey, manage the factors and recovery codes, turn it off. Every change
 * needs a fresh confirmation of the password (or Google): the change is tried, and when the API
 * asks for the step-up the person confirms and the change runs again. Creating a passkey is the
 * exception: the browser wants a fresh click, so the person presses "Create passkey" again.
 */
export function TwoStep({ t, auth, locale, hasPassword }: { t: T; auth: AuthT; locale: Locale; hasPassword: boolean }) {
  const s = t.twoStep;
  const [status, setStatusState] = useState<MfaStatus | null>(null);
  // The latest status for changes that run again later (retry, after the step-up).
  const statusRef = useRef<MfaStatus | null>(null);
  const setStatus = (next: MfaStatus) => {
    statusRef.current = next;
    setStatusState(next);
  };
  const [loadError, setLoadError] = useState<string>();
  const [panel, setPanel] = useState<Panel>({ kind: "none" });
  const [passkeyName, setPasskeyName] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // What the dialog shows, kept while it closes.
  const [dialogShown, setDialogShown] = useState<Dialog>({ kind: "turnOff" });
  const [dialogError, setDialogError] = useState<string>();
  const [stepUp, setStepUp] = useState<{ change: Change; replay: boolean } | null>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string>();
  const [note, setNote] = useState<string>();
  const statusLineRef = useRef<HTMLParagraphElement>(null);
  // Bumped when the control that had focus is gone: focus moves to the status line.
  const [refocus, setRefocus] = useState(0);

  useEffect(() => {
    let ignore = false;
    mfaStatus()
      .then(({ mfa }) => {
        if (ignore) return;
        statusRef.current = mfa;
        setStatusState(mfa);
      })
      .catch((err) => {
        if (ignore) return;
        const e = toApiError(err);
        if (e.status === 401) return redirectToLogin();
        setLoadError(commonErrorMessage(e, auth.errors) ?? auth.errors.generic);
      });
    return () => {
      ignore = true;
    };
  }, [auth.errors]);

  // Back from Google: the step-up is open for 5 minutes. The marker is one-shot.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("two_step") !== "confirm") return;
    params.delete("two_step");
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address on arrival
    setNote(s.googleConfirmed);
  }, [s.googleConfirmed]);

  useEffect(() => {
    if (refocus > 0) statusLineRef.current?.focus();
  }, [refocus]);
  const backToOverview = () => {
    setPanel({ kind: "none" });
    setRefocus((n) => n + 1);
  };

  /** Reads the status again so the page matches the server after a partial or stale change. */
  async function refresh() {
    try {
      setStatus((await mfaStatus()).mfa);
    } catch {
      // The error of the change itself is what the person sees.
    }
  }

  /** A translated message for a failed change; a lost session goes back to log in. */
  function message(err: unknown): string {
    const e = toApiError(err);
    if (e.status === 401) {
      redirectToLogin();
      return "";
    }
    switch (e.code) {
      case "invalid_mfa_code":
        return s.confirmCodeRefused;
      case "invalid_token":
        return s.passkeyExpired;
      case "passkey_invalid":
        return s.passkeyRefused;
      case "validation_error":
        if (e.field === "name") return s.passkeyNameInvalid;
        break;
    }
    return commonErrorMessage(e, auth.errors) ?? auth.errors.generic;
  }

  /**
   * Runs a change. When the API wants a fresh confirmation, the step-up panel opens (instead of
   * any dialog); `replay` runs the change again once the person has confirmed. Returns false when
   * the change did not go through.
   */
  async function run(change: Change, onError: (message: string) => void, replay = true): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setAlert(undefined);
    setNote(undefined);
    try {
      await change(onError);
      return true;
    } catch (err) {
      const e = toApiError(err);
      if (e.code === "reauth_required" || e.code === "google_reauth_required") {
        setDialog(null);
        setStepUp({ change, replay });
      } else {
        onError(message(err));
      }
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // --- changes -------------------------------------------------------------------------------

  const startTotp = () =>
    run(async () => {
      const { totp } = await beginTotp();
      setPanel({ kind: "totp", setup: totp });
    }, setAlert);

  /** A change went through: show the result, and the recovery codes when it turned 2FA on. */
  const applied = (mfa: MfaStatus, recovery?: string[]) => {
    setStatus(mfa);
    setPanel({ kind: "none" });
    if (recovery?.length) setCodes(recovery);
    else {
      setNote(t.saved);
      setRefocus((n) => n + 1);
    }
  };

  /** Removes one factor; one that is already gone counts as removed. */
  async function removeFactor(remove: () => Promise<{ mfa: MfaStatus }>) {
    try {
      setStatus((await remove()).mfa);
    } catch (err) {
      if (!alreadyGone(err)) throw err;
      await refresh();
    }
  }

  const openDialog = (d: Dialog) => {
    setDialogError(undefined);
    setDialogShown(d);
    setDialog(d);
  };

  const confirmDialog = () => {
    const d = dialog;
    if (!d) return;
    setDialogError(undefined);
    void run(async () => {
      try {
        if (d.kind === "regenerate") {
          const { recovery_codes } = await regenerateRecoveryCodes();
          // Close first: the codes take focus, which the open modal would block.
          setDialog(null);
          setCodes(recovery_codes);
          return;
        }
        if (d.kind === "removeApp") await removeFactor(removeTotp);
        else if (d.kind === "removePasskey") await removeFactor(() => removePasskey(d.key.id));
        else {
          // No single "off" in the API: removing the last factor turns it off. Each step reads
          // the latest status, so trying again removes only what is left.
          if (statusRef.current?.totp) await removeFactor(removeTotp);
          for (const k of statusRef.current?.passkeys ?? []) await removeFactor(() => removePasskey(k.id));
        }
      } catch (err) {
        if (d.kind !== "regenerate") await refresh();
        throw err;
      }
      setDialog(null);
      setNote(t.saved);
      setRefocus((n) => n + 1);
    }, setDialogError);
  };

  const createPasskey_ = () =>
    run(
      async (onError) => {
        const options = await passkeyCreationOptions();
        let attestation;
        try {
          attestation = await createPasskey(options.passkey);
        } catch (err) {
          // Nothing reached the server; the options token simply expires.
          onError(passkeyFailureKind(err) === "cancelled" ? s.passkeyCancelled : s.passkeyFailed);
          return;
        }
        const res = await addPasskey({ token: options.token, attestation, name: passkeyName.trim() });
        setPasskeyName("");
        applied(res.mfa, res.recovery_codes);
      },
      setAlert,
      false,
    );

  // --- render --------------------------------------------------------------------------------

  if (loadError)
    return (
      <Section title={s.title} description={s.intro}>
        <FormAlert message={loadError} />
      </Section>
    );
  if (!status)
    return (
      <Section title={s.title} description={s.intro}>
        <p role="status" className="text-sm text-muted">
          {auth.working}
        </p>
      </Section>
    );

  const returnTo = `${localizePath(locale, "/app/account/security")}?${GOOGLE_CONFIRMED}`;
  const shown = dialogShown;

  return (
    <Section title={s.title} description={s.intro}>
      {/* Before the panels: when it closes, the panel that follows can take focus. */}
      <ConfirmDialog
        open={dialog !== null}
        title={
          shown.kind === "removeApp"
            ? s.removeAppTitle
            : shown.kind === "removePasskey"
              ? s.removePasskeyTitle
              : shown.kind === "regenerate"
                ? s.codesRegenerateTitle
                : s.turnOffTitle
        }
        confirmLabel={shown.kind === "regenerate" ? s.codesRegenerateConfirm : shown.kind === "turnOff" ? s.turnOffConfirm : s.removeConfirm}
        cancelLabel={t.cancel}
        tone={shown.kind === "regenerate" ? "primary" : "danger"}
        busy={busy}
        error={dialogError}
        onConfirm={confirmDialog}
        onCancel={() => setDialog(null)}
      >
        {shown.kind === "removeApp"
          ? s.removeAppBody
          : shown.kind === "removePasskey"
            ? format(s.removePasskeyBody, { name: shown.key.name })
            : shown.kind === "regenerate"
              ? s.codesRegenerateBody
              : s.turnOffBody}
      </ConfirmDialog>

      <p ref={statusLineRef} tabIndex={-1} className="text-sm font-medium outline-none">
        {status.enabled ? s.statusOn : s.statusOff}
      </p>

      {codes ? (
        <RecoveryCodes
          s={s}
          codes={codes}
          onDone={() => {
            setCodes(null);
            setRefocus((n) => n + 1);
          }}
        />
      ) : stepUp ? (
        <StepUp
          s={s}
          cancelLabel={t.cancel}
          hasPassword={hasPassword}
          googleHref={googleStartUrl({ returnTo, reauth: true })}
          working={auth.working}
          confirm={async (password) => {
            try {
              await reauth(password);
            } catch (err) {
              return toApiError(err).code === "validation_error" ? s.stepUpWrong : message(err);
            }
            setStepUp(null);
            if (stepUp.replay) await run(stepUp.change, setAlert);
            else setNote(s.passkeyConfirmedAgain);
            return undefined;
          }}
          onCancel={() => {
            setStepUp(null);
            if (panel.kind === "none") setRefocus((n) => n + 1);
          }}
        />
      ) : panel.kind === "totp" ? (
        <TotpSetupPanel
          s={s}
          cancelLabel={t.cancel}
          setup={panel.setup}
          busy={busy}
          onConfirm={(code, onError) =>
            run(async () => {
              const res = await confirmTotp(code);
              applied(res.mfa, res.recovery_codes);
            }, onError)
          }
          onCancel={backToOverview}
        />
      ) : panel.kind === "passkey" ? (
        <AddPasskeyPanel
          s={s}
          cancelLabel={t.cancel}
          busy={busy}
          name={passkeyName}
          onName={setPasskeyName}
          onCreate={() => void createPasskey_()}
          onCancel={backToOverview}
        />
      ) : (
        <Overview
          s={s}
          locale={locale}
          status={status}
          busy={busy}
          onSetUpApp={() => void startTotp()}
          onAddPasskey={() => {
            setAlert(undefined);
            setNote(undefined);
            setPanel({ kind: "passkey" });
          }}
          onDialog={openDialog}
        />
      )}

      <FormAlert message={alert} />
      <SavedNote message={note} />
    </Section>
  );
}

type S = T["twoStep"];

function Overview({
  s,
  locale,
  status,
  busy,
  onSetUpApp,
  onAddPasskey,
  onDialog,
}: {
  s: S;
  locale: Locale;
  status: MfaStatus;
  busy: boolean;
  onSetUpApp: () => void;
  onAddPasskey: () => void;
  onDialog: (d: Dialog) => void;
}) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{s.appTitle}</h3>
        {status.totp ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">{s.appOn}</p>
            <Button variant="secondary" busy={busy} onClick={() => onDialog({ kind: "removeApp" })}>
              {s.removeApp}
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="secondary" busy={busy} onClick={onSetUpApp}>
              {s.setUpApp}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{s.passkeysTitle}</h3>
        {status.passkeys.length > 0 && (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {status.passkeys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium break-words">{key.name}</span>
                  <span className="text-xs text-muted">{format(s.passkeyAdded, { date: date.format(new Date(key.created_at)) })}</span>
                </div>
                <Button
                  variant="secondary"
                  busy={busy}
                  aria-label={format(s.removePasskeyNamed, { name: key.name })}
                  onClick={() => onDialog({ kind: "removePasskey", key })}
                >
                  {s.removeConfirm}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Button variant="secondary" busy={busy} onClick={onAddPasskey}>
            {s.addPasskey}
          </Button>
        </div>
      </div>

      {status.enabled && (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{s.codesHeading}</h3>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">{format(s.codesLeft, { count: String(status.recovery_codes_left) })}</p>
              <Button variant="secondary" busy={busy} onClick={() => onDialog({ kind: "regenerate" })}>
                {s.codesRegenerate}
              </Button>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <Button variant="secondary" busy={busy} onClick={() => onDialog({ kind: "turnOff" })} className="text-danger">
              {s.turnOff}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StepUp({
  s,
  cancelLabel,
  hasPassword,
  googleHref,
  working,
  confirm,
  onCancel,
}: {
  s: S;
  cancelLabel: string;
  hasPassword: boolean;
  googleHref: string;
  working: string;
  confirm: (password: string) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => (hasPassword ? ref.current : linkRef.current)?.focus(), [hasPassword]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password === "") {
      setError(s.stepUpRequired);
      return ref.current?.focus();
    }
    setBusy(true);
    const failed = await confirm(password);
    setBusy(false);
    if (failed) {
      setError(failed);
      ref.current?.select();
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{s.stepUpTitle}</h3>
      {hasPassword ? (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-pretty text-muted">{s.stepUpIntro}</p>
          <PasswordField
            ref={ref}
            label={s.stepUpPassword}
            autoComplete="current-password"
            value={password}
            error={error}
            showLabel={s.showPassword}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" busy={busy}>
              {busy ? working : s.stepUpSubmit}
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-pretty text-muted">{s.stepUpGoogleIntro}</p>
          <div className="flex flex-wrap gap-3">
            <a
              ref={linkRef}
              href={googleHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-control px-4 text-sm font-semibold hover:bg-foreground/5"
            >
              {s.stepUpGoogle}
            </a>
            <Button variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TotpSetupPanel({
  s,
  cancelLabel,
  setup,
  busy,
  onConfirm,
  onCancel,
}: {
  s: S;
  cancelLabel: string;
  setup: TotpSetup;
  busy: boolean;
  onConfirm: (code: string, onError: (msg: string) => void) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  useEffect(() => {
    let url: string | null = null;
    let ignore = false;
    totpQrCode(setup.uri)
      .then((blob) => {
        if (ignore) return;
        url = URL.createObjectURL(blob);
        setQr(url);
      })
      .catch(() => {
        // The key below works without the picture.
        if (!ignore) setQrFailed(true);
      });
    return () => {
      ignore = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [setup.uri]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const digits = code.replace(/[\s -]/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setError(s.confirmCodeInvalid);
      return ref.current?.focus();
    }
    const ok = await onConfirm(digits, setError);
    if (!ok) ref.current?.select();
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none">
        {s.setUpApp}
      </h3>
      <p className="text-sm text-pretty text-muted">{s.totpScan}</p>
      {qrFailed ? (
        <p role="status" className="text-sm text-pretty">
          {s.qrFailed}
        </p>
      ) : (
        // The Paper Rule: the code sits on white in both themes.
        <div aria-busy={qr === null} className="flex size-[13.5rem] items-center justify-center rounded-sm bg-white p-2">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- a blob: URL of our own render
            <img src={qr} alt={s.qrAlt} width={200} height={200} />
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-muted">{s.secretLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-sm bg-foreground/5 px-2 py-1 font-mono text-sm tabular-nums break-all">{groupSecret(setup.secret)}</code>
          <CopyButton value={setup.secret} label={s.secretCopy} copiedLabel={s.copied} failedLabel={s.copyFailed} />
        </div>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          ref={ref}
          label={s.confirmCodeLabel}
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={12}
          spellCheck={false}
          className="font-mono tabular-nums tracking-widest"
          value={code}
          error={error}
          help={s.turnOnNote}
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" busy={busy}>
            {s.confirmApp}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AddPasskeyPanel({
  s,
  cancelLabel,
  busy,
  name,
  onName,
  onCreate,
  onCancel,
}: {
  s: S;
  cancelLabel: string;
  busy: boolean;
  name: string;
  onName: (name: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const ref = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const supported = passkeysSupported();
  useEffect(() => (supported ? ref.current : headingRef.current)?.focus(), [supported]);

  if (!supported)
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <h3 ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none">
          {s.addPasskey}
        </h3>
        <p role="status" className="text-sm text-pretty">
          {s.passkeyUnsupported}
        </p>
        <div>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === "") {
      setError(s.passkeyNameRequired);
      return ref.current?.focus();
    }
    onCreate();
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold">{s.addPasskey}</h3>
      <TextField
        ref={ref}
        label={s.passkeyName}
        help={s.passkeyNameHelp}
        maxLength={100}
        autoComplete="off"
        value={name}
        error={error}
        onChange={(e) => {
          onName(e.target.value);
          setError(undefined);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy}>
          {s.passkeyCreate}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
      </div>
    </form>
  );
}

function RecoveryCodes({ s, codes, onDone }: { s: S; codes: string[]; onDone: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const text = codes.join("\n");
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-accent/40 p-4">
      <h3 ref={ref} tabIndex={-1} className="text-sm font-semibold outline-none">
        {s.codesTitle}
      </h3>
      <p className="text-sm text-pretty">{s.codesIntro}</p>
      <ul aria-label={s.codesTitle} className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm tabular-nums">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <CopyButton value={text} label={s.codesCopy} copiedLabel={s.copied} failedLabel={s.copyFailed} />
        <Button variant="secondary" onClick={() => saveBlob(new Blob([text + "\n"], { type: "text/plain" }), s.codesFileName)}>
          {s.codesDownload}
        </Button>
      </div>
      <div>
        <Button onClick={onDone}>{s.codesDone}</Button>
      </div>
    </div>
  );
}
