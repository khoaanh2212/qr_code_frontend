"use client";

import { BookmarkPlus } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { CodeDesign, DesignTemplate } from "@/lib/api/types";
import { createTemplate, listTemplates } from "./api";

type T = Messages["templates"];

/** What a failed template request means for the person saving it. */
export function templateError(err: unknown, t: T): string {
  if (err instanceof ApiError) {
    if (err.code === "template_name_taken") return t.errors.nameTaken;
    if (err.code === "template_limit_reached") return t.errors.limit;
    if (err.code === "validation_error" && err.field === "name") return t.errors.nameRequired;
  }
  return t.errors.generic;
}

/**
 * Apply a saved design, or save the current one, in a workspace. Applying copies the template's
 * design through `onApply`; nothing stays linked to the template.
 */
export function TemplateBar({
  t,
  workspaceId,
  currentDesign,
  onApply,
  onUnauthenticated,
}: {
  t: T;
  workspaceId: string;
  /** The design to save, read when the person saves. */
  currentDesign: () => CodeDesign;
  onApply: (design: CodeDesign) => void;
  /** The session ended (401). */
  onUnauthenticated?: () => void;
}) {
  const ids = { select: useId(), name: useId() };
  const [templates, setTemplates] = useState<DesignTemplate[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const unauth = useRef(onUnauthenticated);
  useEffect(() => {
    unauth.current = onUnauthenticated;
  });

  useEffect(() => {
    const abort = new AbortController();
    listTemplates(workspaceId, abort.signal)
      .then(setTemplates)
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return unauth.current?.();
        setLoadFailed(true);
      });
    return () => abort.abort();
  }, [workspaceId]);

  useEffect(() => {
    if (saving) nameRef.current?.focus();
    // The form closed under the person's focus: back to the button that opened it.
    else if (returnFocus.current) saveRef.current?.focus();
    returnFocus.current = false;
  }, [saving]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setStatus({ ok: false, text: t.errors.nameRequired });
      return;
    }
    setBusy(true);
    try {
      const created = await createTemplate(workspaceId, name, currentDesign());
      setTemplates((ts) => [created, ...(ts ?? [])]);
      setLoadFailed(false);
      returnFocus.current = true;
      setSaving(false);
      setName("");
      setStatus({ ok: true, text: t.saved });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return unauth.current?.();
      setStatus({ ok: false, text: templateError(err, t) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={ids.select} className="text-sm font-medium">
            {t.apply}
          </label>
          <select
            id={ids.select}
            value=""
            disabled={!templates || templates.length === 0}
            onChange={(e) => {
              const picked = templates?.find((x) => x.id === e.target.value);
              if (!picked) return;
              onApply(picked.design);
              setStatus({ ok: true, text: t.applied });
            }}
            className="min-h-11 w-full rounded-md border border-control bg-surface px-3 disabled:opacity-60"
          >
            <option value="">{templates && templates.length === 0 ? t.none : t.choose}</option>
            {templates?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        {!saving && (
          <Button ref={saveRef} variant="secondary" onClick={() => setSaving(true)}>
            <BookmarkPlus aria-hidden="true" className="size-4" />
            {t.save}
          </Button>
        )}
      </div>
      {saving && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={ids.name} className="text-sm font-medium">
              {t.name}
            </label>
            <input
              ref={nameRef}
              id={ids.name}
              value={name}
              maxLength={60}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 w-full rounded-md border border-control bg-surface px-3 text-base"
            />
          </div>
          <Button type="submit" variant="secondary" busy={busy}>
            {t.saveConfirm}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              returnFocus.current = true;
              setSaving(false);
              setStatus(null);
            }}
          >
            {t.cancel}
          </Button>
          <p className="w-full text-xs text-muted">{t.logoNote}</p>
        </form>
      )}
      {/* Success in a polite region, failures as alerts. */}
      <p role="status" className="min-h-5 text-sm empty:min-h-0">
        {status?.ok ? status.text : ""}
      </p>
      <p role="alert" className="text-sm font-medium text-danger empty:hidden">
        {status && !status.ok ? status.text : loadFailed ? t.errors.generic : ""}
      </p>
    </div>
  );
}
