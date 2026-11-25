"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FormAlert } from "@/components/form/form-bits";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { format } from "@/i18n/config";
import { updateCode } from "./api";
import { codeFailure, type CodeField } from "./errors";
import { SLUG_LIMITS, slugOrigin, validSlug } from "./slug-rules";

type T = Messages["codes"];

type Props = {
  t: T;
  auth: AuthMessages;
  ws: string;
  code: DynamicCode;
  onSaved: (code: DynamicCode) => void;
  /** `saved` is true after a change, so the card can announce it. */
  onClose: (saved?: boolean) => void;
};

/** Inline editor for the short link's last part. Only the owner of an unlocked code gets it. */
export function SlugEditor({ t, auth, ws, code, onSaved, onClose }: Props) {
  const [slug, setSlug] = useState(() => (validSlug(code.short_code) ? code.short_code : ""));
  const origin = slugOrigin(code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: CodeField; message: string } | null>(null);
  const sending = useRef(false); // state lags a second submit in the same tick
  const inputRef = useRef<HTMLInputElement>(null);

  // A generated code is never a valid custom link, so it opens empty; a custom one is selected for replacing.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || sending.current) return;
    const next = slug.trim(); // the only normalisation: what is typed is otherwise judged as it is
    setSlug(next);
    if (next === code.short_code) return onClose();
    if (!validSlug(next)) {
      setError({ field: "short_code", message: format(t.errors.slugShape, SLUG_LIMITS) });
      inputRef.current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateCode(ws, code.id, { short_code: next }));
      onClose(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const failure = codeFailure(err, t, auth);
      setError(failure);
      if (failure.field === "short_code") inputRef.current?.focus();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <form noValidate aria-label={t.editLink}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }} className="flex flex-col gap-3">
      <TextField
            ref={inputRef}
            label={t.slugLabel}
            help={format(t.slugHelp, { origin, ...SLUG_LIMITS })}
            leading={<span aria-hidden="true">{origin}</span>}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono"
            readOnly={busy}
            value={slug}
            error={error?.field === "short_code" ? error.message : undefined}
            onChange={(e) => {
              setSlug(e.target.value);
              setError(null); // a message describes the old value
            }}
      />
      <p className="text-sm text-pretty text-muted">{format(t.slugNote, SLUG_LIMITS)}</p>
      <FormAlert message={error && error.field !== "short_code" ? error.message : undefined} />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy}>
          {t.save}
        </Button>
        <Button variant="secondary" onClick={() => onClose()}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
