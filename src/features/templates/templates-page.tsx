"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert, TextLink } from "@/components/form/form-bits";
import { redirectToLogin, usePersonalWorkspace } from "@/features/auth/require-session";
import { render } from "@/features/qr-editor/use-render";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DesignTemplate } from "@/lib/api/types";
import { buildRenderRequest } from "@/lib/qr/render-request";
import { DEFAULT_DESIGN } from "@/lib/qr/types";
import { deleteTemplate, listTemplates, renameTemplate } from "./api";
import { applyTemplate } from "./convert";
import { templateError } from "./template-bar";

type T = Messages["templates"];

/** The workspace's templates: a preview of each, rename and delete. */
export function TemplatesPage({ t, back, locale }: { t: T; back: string; locale: Locale }) {
  const workspace = usePersonalWorkspace();
  const [templates, setTemplates] = useState<DesignTemplate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<string>();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!workspace) return;
    const abort = new AbortController();
    listTemplates(workspace.id, abort.signal)
      .then(setTemplates)
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setFailed(true);
      });
    return () => abort.abort();
  }, [workspace]);

  return (
    <div className="flex flex-col gap-6">
      <TextLink href={localizePath(locale, "/app")}>← {back}</TextLink>
      <header className="flex flex-col gap-1">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold outline-none">
          {t.title}
        </h1>
        <p className="max-w-prose text-sm text-pretty text-muted">{t.intro}</p>
      </header>
      <p role="status" className="min-h-5 text-sm">
        {status ?? ""}
      </p>
      {templates === null && !failed && (
        <p role="status" className="text-sm text-muted">
          {t.title}…
        </p>
      )}
      {(failed || !workspace) && templates === null && <FormAlert message={t.errors.generic} />}
      {templates?.length === 0 && <p className="text-sm text-muted">{t.empty}</p>}
      {templates && templates.length > 0 && workspace && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              t={t}
              workspaceId={workspace.id}
              template={tpl}
              onRenamed={(updated) => setTemplates((ts) => ts?.map((x) => (x.id === updated.id ? updated : x)) ?? null)}
              onDeleted={() => {
                setTemplates((ts) => ts?.filter((x) => x.id !== tpl.id) ?? null);
                // Named, so a second deletion is announced too.
                setStatus(`${t.deleted} ${tpl.name}`);
                headingRef.current?.focus(); // the card under the focus is gone
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateCard({
  t,
  workspaceId,
  template,
  onRenamed,
  onDeleted,
}: {
  t: T;
  workspaceId: string;
  template: DesignTemplate;
  onRenamed: (t: DesignTemplate) => void;
  onDeleted: () => void;
}) {
  const nameId = useId();
  const [src, setSrc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(template.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const nameRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const backFocus = useRef(false);
  const designKey = JSON.stringify(template.design);

  // A small preview: the design applied to a sample link (the template has no content).
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const design = applyTemplate(DEFAULT_DESIGN, JSON.parse(designKey) as DesignTemplate["design"]);
    render(buildRenderRequest({ type: "url", data: { url: "https://example.com" }, design, format: "png", size: 256 }))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [designKey]);

  useEffect(() => {
    if (editing) nameRef.current?.focus();
    else if (backFocus.current) renameRef.current?.focus();
    backFocus.current = false;
  }, [editing]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      onRenamed(await renameTemplate(workspaceId, template.id, name));
      backFocus.current = true;
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(templateError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await deleteTemplate(workspaceId, template.id);
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      setError(templateError(err, t));
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="mx-auto size-36 rounded-md bg-white p-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL, nothing to optimize */}
        {src && <img src={src} alt={format(t.preview, { name: template.name })} className="size-full" />}
      </div>
      {editing ? (
        <form onSubmit={rename} className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm font-medium">
            {t.name}
          </label>
          <input
            ref={nameRef}
            id={nameId}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-md border border-control bg-surface px-3 text-base"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" busy={busy}>
              {t.rename}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                backFocus.current = true;
                setEditing(false);
                setName(template.name);
                setError(undefined);
              }}
            >
              {t.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <p className="truncate font-medium">{template.name}</p>
      )}
      {!editing && (
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <Button ref={confirmRef} variant="danger" busy={busy} onClick={() => void remove()}>
                {t.deleteConfirm}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                {t.cancel}
              </Button>
            </>
          ) : (
            <>
              <Button ref={renameRef} variant="secondary" aria-label={`${t.rename}: ${template.name}`} onClick={() => setEditing(true)}>
                {t.rename}
              </Button>
              <Button variant="secondary" aria-label={`${t.delete}: ${template.name}`} onClick={() => setConfirming(true)}>
                {t.delete}
              </Button>
            </>
          )}
        </div>
      )}
      <FormAlert message={error} />
    </li>
  );
}
