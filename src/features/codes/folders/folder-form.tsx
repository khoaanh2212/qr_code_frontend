"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { FormAlert } from "@/components/form/form-bits";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { folderFailure } from "./errors";
import { FOLDER_LIMITS, FOLDER_NAME_MAX, normalizeFolderName } from "./rules";

type T = Messages["codes"];

export interface FolderFormProps {
  t: T;
  /** Names the form for screen readers ("New folder", "Rename"). */
  label: string;
  submitLabel: string;
  initialName?: string;
  /** Rejects with the API's error; the form shows it and stays open. */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Create or rename: one name field, inline errors (taken, limit, invalid, rate limit), Enter
 * saves, Escape cancels. Opens with the name focused. The name is trimmed before it is sent.
 */
export function FolderForm({ t, label, submitLabel, initialName = "", onSubmit, onClose }: FolderFormProps) {
  const f = t.folders;
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: "name"; message: string }>();
  const input = useRef<HTMLInputElement>(null);

  // Once, when the form opens (it is keyed by folder): a reload must not steal focus or selection.
  const [opened] = useState(initialName);
  useEffect(() => {
    input.current?.focus();
    if (opened) input.current?.select();
  }, [opened]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = normalizeFolderName(name); // as the server stores it, so the count matches
    if (trimmed === "" || [...trimmed].length > FOLDER_NAME_MAX) {
      setError({ field: "name", message: format(f.errors.nameInvalid, FOLDER_LIMITS) });
      input.current?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      const failure = folderFailure(err, f);
      setError(failure);
      if (failure.field) input.current?.focus();
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      aria-label={label}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) {
          e.preventDefault();
          onClose();
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:max-w-md"
    >
      <TextField
        ref={input}
        label={f.name}
        help={format(f.nameHelp, FOLDER_LIMITS)}
        autoComplete="off"
        readOnly={busy}
        value={name}
        error={error?.field ? error.message : undefined}
        onChange={(e) => {
          setName(e.target.value);
          setError(undefined); // a message describes the old value
        }}
      />
      <FormAlert message={error && !error.field ? error.message : undefined} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" busy={busy}>
          {submitLabel}
        </Button>
        <Button variant="secondary" onClick={onClose} className="border-transparent text-muted">
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}
