"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { SavedNote } from "@/features/account/section";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { updateCode } from "../api";
import { NAME_MAX } from "../code-form";
import { destinationChanges, initialDestination, isDestinationField, type DestinationField, type DestinationState } from "../destination";
import { DestinationFields } from "../destination-fields";
import { codeFailure, type CodeField } from "../errors";
import { useCode } from "../use-code";
import { ACTION_BAR_ROOM, ActionBar } from "./action-bar";
import { CodePageState } from "./code-page-state";

type T = Messages["codes"];

/**
 * A code's content: where it leads (an address or a social profile preset) and its name, with
 * "Save changes" in the action bar. Viewers and a code locked by an operator see the fields
 * read-only, with why.
 */
export function CodeContent({
  t,
  generator,
  auth,
  locale,
}: {
  t: T;
  generator: Messages["generator"];
  auth: AuthMessages;
  locale: Locale;
}) {
  const { id } = useParams<{ id: string }>();
  const { load, setCode, workspaceId, canEdit } = useCode(id);
  if (load.kind !== "ready" || !workspaceId) return <CodePageState t={t} locale={locale} load={load} loading={t.insights.loading} />;
  return <ContentForm key={load.code.id} t={t} generator={generator} auth={auth} locale={locale} ws={workspaceId} code={load.code} canEdit={canEdit} onSaved={setCode} />;
}

function ContentForm({
  t,
  generator,
  auth,
  locale,
  ws,
  code,
  canEdit,
  onSaved,
}: {
  t: T;
  generator: Messages["generator"];
  auth: AuthMessages;
  locale: Locale;
  ws: string;
  code: DynamicCode;
  canEdit: boolean;
  onSaved: (code: DynamicCode) => void;
}) {
  const p = t.pages;
  const [name, setName] = useState(code.name);
  const [destination, setDestination] = useState<DestinationState>(() => initialDestination(code.target_url));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ field?: CodeField; message: string } | null>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const focusDestination = (field: DestinationField) =>
    (field === "social.text" ? textRef : field === "social.username" ? usernameRef : targetRef).current?.focus();
  // The fields are disabled while a save is under way: a refusal is focused once they are back.
  const refocus = useRef<DestinationField | null>(null);
  useEffect(() => {
    const field = refocus.current;
    if (busy || !field) return;
    refocus.current = null;
    (field === "social.text" ? textRef : field === "social.username" ? usernameRef : targetRef).current?.focus();
  }, [busy]);
  const formId = "code-content";
  const locked = code.status === "locked";
  const readOnly = !canEdit || locked;
  const back = localizePath(locale, `/app/codes/${encodeURIComponent(code.id)}/insights`);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || readOnly) return;
    const checked = destinationChanges(destination, code.target_url, t);
    if (!checked.ok) {
      setError({ field: checked.field, message: checked.message });
      focusDestination(checked.field);
      return;
    }
    const changes = {
      ...(name.trim() !== code.name ? { name: name.trim() } : {}),
      ...checked.changes,
    };
    setSaved(false);
    setError(null);
    if (Object.keys(changes).length === 0) return setSaved(true);
    setBusy(true);
    try {
      const updated = await updateCode(ws, code.id, changes);
      onSaved(updated);
      setName(updated.name);
      setDestination(initialDestination(updated.target_url));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const failure = codeFailure(err, t, auth);
      setError(failure);
      if (isDestinationField(failure.field)) refocus.current = failure.field;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex max-w-xl flex-col gap-6 ${ACTION_BAR_ROOM}`}>
      <TextLink href={back}>← {p.backToCode}</TextLink>
      <header className="flex flex-col gap-1">
        <p className="truncate text-sm text-muted">{code.name || t.untitled}</p>
        <h1 className="text-2xl font-semibold">{p.contentTitle}</h1>
        <p className="text-sm text-pretty text-muted">{p.contentIntro}</p>
      </header>
      {readOnly && <p className="rounded-md border border-border bg-surface p-3 text-sm text-pretty">{locked ? t.lockedIntro : p.viewerNote}</p>}
      <form id={formId} noValidate onSubmit={submit}>
        <fieldset disabled={readOnly} className="flex flex-col gap-5">
          <DestinationFields
            t={t}
            generator={generator}
            value={destination}
            error={error}
            urlRef={targetRef}
            usernameRef={usernameRef}
            textRef={textRef}
            readOnly={busy}
            onChange={(update) => {
              setDestination(update);
              setSaved(false);
            }}
          />
          <TextField
            label={t.name}
            help={t.nameHelp}
            maxLength={NAME_MAX}
            autoComplete="off"
            readOnly={busy}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        </fieldset>
      </form>
      <FormAlert message={error && !isDestinationField(error.field) ? error.message : undefined} />
      <SavedNote message={saved ? t.saved : undefined} />
      <ActionBar>
        <Link
          href={back}
          className="inline-flex min-h-11 items-center rounded-md border border-control bg-surface px-4 text-sm font-medium hover:bg-foreground/5"
        >
          {t.cancel}
        </Link>
        {!readOnly && (
          <Button type="submit" form={formId} busy={busy}>
            {p.saveChanges}
          </Button>
        )}
      </ActionBar>
    </div>
  );
}
