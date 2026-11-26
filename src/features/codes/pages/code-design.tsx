"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { SavedNote } from "@/features/account/section";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { updateCode } from "../api";
import { designFromLook, lookFromDesign, lookScannable, type CodeLook } from "../design";
import { PreviewPane, useLookPreview } from "../design-preview";
import { codeFailure, type CodeField } from "../errors";
import { LookFields } from "../look-fields";
import { useCode } from "../use-code";
import { ACTION_BAR_ROOM, ActionBar } from "./action-bar";
import { CodePageState } from "./code-page-state";

type T = Messages["codes"];

/**
 * A code's design: the options beside a live drawing of the code itself (its own short link), with
 * "Save changes" in the action bar. The short link stays the same, so printed codes keep working.
 * Viewers and a locked code see it read-only, with why.
 */
export function CodeDesign({
  t,
  generator,
  templates,
  auth,
  locale,
}: {
  t: T;
  generator: Messages["generator"];
  templates: Messages["templates"];
  auth: AuthMessages;
  locale: Locale;
}) {
  const { id } = useParams<{ id: string }>();
  const { load, setCode, workspaceId, canEdit } = useCode(id);
  if (load.kind !== "ready" || !workspaceId) return <CodePageState t={t} locale={locale} load={load} loading={t.insights.loading} />;
  return (
    <DesignForm
      key={load.code.id}
      t={t}
      generator={generator}
      templates={templates}
      auth={auth}
      locale={locale}
      ws={workspaceId}
      code={load.code}
      canEdit={canEdit}
      onSaved={setCode}
    />
  );
}

function DesignForm({
  t,
  generator,
  templates,
  auth,
  locale,
  ws,
  code,
  canEdit,
  onSaved,
}: {
  t: T;
  generator: Messages["generator"];
  templates: Messages["templates"];
  auth: AuthMessages;
  locale: Locale;
  ws: string;
  code: DynamicCode;
  canEdit: boolean;
  onSaved: (code: DynamicCode) => void;
}) {
  const p = t.pages;
  const [look, setLook] = useState<CodeLook>(() => lookFromDesign(code.design));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<{ field?: CodeField; message: string } | null>(null);
  const { preview, blocked } = useLookPreview(look, code.short_url);
  const formId = "code-design";
  const locked = code.status === "locked";
  const readOnly = !canEdit || locked;
  const back = localizePath(locale, `/app/codes/${encodeURIComponent(code.id)}/insights`);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || readOnly) return;
    setSaved(false);
    if (!lookScannable(look)) return setError({ field: "colors", message: t.errors.colors });
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateCode(ws, code.id, { design: designFromLook(look, code.design) }));
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(codeFailure(err, t, auth));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col gap-6 ${ACTION_BAR_ROOM}`}>
      <TextLink href={back}>← {p.backToCode}</TextLink>
      <header className="flex flex-col gap-1">
        <p className="truncate text-sm text-muted">{code.name || t.untitled}</p>
        <h1 className="text-2xl font-semibold">{t.designTitle}</h1>
        <p className="max-w-prose text-sm text-pretty text-muted">{t.designIntro}</p>
      </header>
      {readOnly && <p className="max-w-xl rounded-md border border-border bg-surface p-3 text-sm text-pretty">{locked ? t.lockedIntro : p.viewerNote}</p>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        {/* First in the document, so it is first on narrow screens for everyone; beside the options from `lg`. */}
        <PreviewPane
          t={t}
          preview={preview}
          blocked={blocked}
          transparent={look.transparent}
          resetLabel={t.wizard.resetDesign}
          onReset={() => {
            setLook(lookFromDesign(code.design));
            setSaved(false);
            setError(null);
          }}
        />
        <form
          id={formId}
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => {
            // Enter in a text field (a color, the frame's caption) must not save half a change.
            if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
          }}
          className="flex min-w-0 flex-col gap-5 lg:max-w-xl"
        >
          <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
            <LookFields
              t={t}
              generator={generator}
              look={look}
              onChange={(update) => {
                setLook(update);
                setSaved(false);
                setError(null); // a field message describes the old value
              }}
              error={error}
              templates={readOnly ? undefined : { t: templates, workspaceId: ws }}
            />
          </fieldset>
          <FormAlert message={error && !error.field ? error.message : undefined} />
          <SavedNote message={saved ? t.saved : undefined} />
        </form>
      </div>
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
