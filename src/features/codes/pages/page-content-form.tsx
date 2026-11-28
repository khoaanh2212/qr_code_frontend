"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/form/form-bits";
import { TextField } from "@/components/ui/text-field";
import { SavedNote } from "@/features/account/section";
import type { AuthMessages } from "@/features/auth/form-rules";
import { redirectToLogin } from "@/features/auth/require-session";
import { getPageTypes } from "@/features/pages/api";
import {
  buildContent,
  contentPath,
  draftFromContent,
  editorPath,
  pageToSend,
  sameContent,
  type PageDraft,
  type PageTypeInfo,
} from "@/features/pages/content";
import { focusPageField, PageEditor } from "@/features/pages/page-editor";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { CodePage, DynamicCode, PageTheme } from "@/lib/api/types";
import { updateCode, type CodeChanges } from "../api";
import { NAME_MAX } from "../code-form";
import { codeFailure } from "../errors";
import { SaveActions } from "./action-bar";

type T = Messages["codes"];

/**
 * The content of a page code (backend PLAN item 27c): its page in the editor "New code" uses,
 * filled from what was saved, and its name. The type stays as it is; the page's frame (cover,
 * button, social channels) is sent back as saved. Only what changed is sent, so saving an
 * unchanged page writes nothing. Viewers and a locked code see the fields disabled and no
 * preview (previews are for editors).
 */
export function PageContentForm({
  t,
  pages,
  generator,
  auth,
  locale,
  ws,
  code,
  page,
  readOnly,
  back,
  onSaved,
}: {
  t: T;
  pages: Messages["pages"];
  generator: Messages["generator"];
  auth: AuthMessages;
  locale: Locale;
  ws: string;
  code: DynamicCode;
  page: CodePage;
  readOnly: boolean;
  /** The code's insights page, where "Cancel" leads. */
  back: string;
  onSaved: (code: DynamicCode) => void;
}) {
  const formId = "code-content";
  const [types, setTypes] = useState<PageTypeInfo[] | null>(null);
  const [typesFailed, setTypesFailed] = useState(false);
  const [typesTry, setTypesTry] = useState(0);
  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [theme, setTheme] = useState<PageTheme>(page.theme);
  const [name, setName] = useState(code.name);
  const [pageErrors, setPageErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A field refused by the API is focused once the save is over.
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPageTypes(controller.signal)
      .then(setTypes)
      .catch(() => {
        if (!controller.signal.aborted) setTypesFailed(true);
      });
    return () => controller.abort();
  }, [typesTry]);

  const type = types?.find((p) => p.name === page.type) ?? null;
  // A saved page whose type the API no longer offers can only be renamed.
  const typeMissing = types !== null && type === null;
  // The saved content as the editor holds it, once the type's fields are known.
  const initial = useMemo(() => (type ? draftFromContent(type, page.content) : null), [type, page.content]);
  const value = draft ?? initial;
  const built = useMemo(() => (type && value ? buildContent(type, value) : null), [type, value]);
  const places = built?.ok ? built.places : undefined;
  const body = type && built?.ok ? pageToSend(page, theme, built.content) : null;
  // The page changed when the editor's values or the colors did; comparing editor values (not the
  // rebuilt content with the saved one) keeps a page the API stored differently from being resent.
  const pageEdited = (draft !== null && !sameContent(draft, initial)) || !sameContent(theme, page.theme);

  useEffect(() => {
    const path = refocus.current;
    if (busy || !path) return;
    refocus.current = null;
    if (!focusPageField(path)) setError(pages.invalid);
  }, [busy, pages.invalid]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || readOnly) return;
    if (pageEdited && built && !built.ok) {
      setPageErrors(Object.fromEntries(built.missing.map((path) => [path, pages.required])));
      setError(pages.missingSome);
      setSaved(false);
      if (built.missing[0]) focusPageField(built.missing[0]);
      return;
    }
    const changes: CodeChanges = {
      ...(name.trim() !== code.name ? { name: name.trim() } : {}),
      ...(pageEdited && built?.ok ? { page: pageToSend(page, theme, built.content) } : {}),
    };
    setSaved(false);
    setError(null);
    if (Object.keys(changes).length === 0) return setSaved(true);
    setBusy(true);
    try {
      const updated = await updateCode(ws, code.id, changes);
      onSaved(updated);
      setName(updated.name);
      // The editor starts again from what the API saved.
      setDraft(null);
      if (updated.page) setTheme(updated.page.theme);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      const sent = err instanceof ApiError && err.code === "validation_error" ? contentPath(err.field) : undefined;
      if (sent) {
        const path = editorPath(sent, places);
        setPageErrors({ [path]: pages.invalid });
        refocus.current = path;
      } else setError(codeFailure(err, t, auth).message);
    } finally {
      setBusy(false);
    }
  }

  function edited() {
    setSaved(false);
    if (error) setError(null);
    if (Object.keys(pageErrors).length > 0) setPageErrors({});
  }

  return (
    <>
      <form id={formId} noValidate onSubmit={submit}>
        <fieldset disabled={readOnly} className="flex flex-col gap-6">
          {!types && !typesFailed && (
            <p role="status" className="text-sm text-muted">
              {t.insights.loading}
            </p>
          )}
          {typeMissing && (
            <p role="alert" className="text-sm text-pretty">
              {pages.typesFailed}
            </p>
          )}
          {typesFailed && !types && (
            <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {pages.typesFailed}
              <button
                type="button"
                onClick={() => {
                  setTypesFailed(false);
                  setTypesTry((n) => n + 1);
                }}
                className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-4 hover:underline"
              >
                {pages.retry}
              </button>
            </p>
          )}
          {type && value && (
            <PageEditor
              t={pages}
              generator={generator}
              workspaceId={ws}
              lang={locale}
              type={type}
              draft={value}
              onDraft={(update) => {
                setDraft((d) => update(d ?? value));
                edited();
              }}
              theme={theme}
              onTheme={(update) => {
                setTheme(update);
                edited();
              }}
              errors={pageErrors}
              body={body}
              preview={!readOnly}
              onRefused={(path) => setPageErrors({ [editorPath(path, places)]: pages.invalid })}
            />
          )}
          <div className="max-w-xl">
            <TextField
              label={t.name}
              help={t.nameHelp}
              maxLength={NAME_MAX}
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
                if (error) setError(null);
              }}
            />
          </div>
        </fieldset>
      </form>
      <FormAlert message={error ?? undefined} />
      <SavedNote message={saved ? t.saved : undefined} />
      <SaveActions back={back} cancel={t.cancel} save={t.pages.saveChanges} formId={formId} busy={busy} canSave={!readOnly} />
    </>
  );
}

