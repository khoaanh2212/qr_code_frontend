"use client";

import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ColorInput } from "@/features/qr-editor/color-input";
import type { PageBody, PageDraft, PageTheme, PageTypeInfo } from "./content";
import { PageFields } from "./page-fields";
import { PagePreview } from "./page-preview";

/**
 * A hosted page's editor: its content fields and two colors, beside a phone frame with the
 * type's sample or the live preview (`body`, once the required fields are filled). Shared by
 * "New code" and the content page of a page code. Without `preview` (a viewer, who may not ask
 * for previews) the phone frame is left out.
 */
export function PageEditor({
  t,
  generator,
  workspaceId,
  lang,
  type,
  draft,
  onDraft,
  theme,
  onTheme,
  errors,
  body,
  preview = true,
  onRefused,
}: {
  t: Messages["pages"];
  generator: Messages["generator"];
  workspaceId: string;
  lang: Locale;
  type: PageTypeInfo;
  draft: PageDraft;
  onDraft: (update: (d: PageDraft) => PageDraft) => void;
  theme: PageTheme;
  onTheme: (update: (theme: PageTheme) => PageTheme) => void;
  errors: Record<string, string>;
  body: PageBody | null;
  preview?: boolean;
  /** A field the preview refused, by the API's path of the sent content. */
  onRefused: (path: string) => void;
}) {
  return (
    <div className={`grid gap-8 ${preview ? "md:grid-cols-[minmax(0,1fr)_16rem] md:items-start lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12" : ""}`}>
      <div className="flex min-w-0 flex-col gap-6">
        <PageFields workspaceId={workspaceId} t={t} generator={generator} type={type} value={draft} errors={errors} onChange={onDraft} />
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-1.5 text-sm font-semibold">{t.theme}</legend>
          <div className="flex flex-wrap gap-4">
            <ColorInput t={generator} label={t.primary} value={theme.primary} onChange={(primary) => onTheme((th) => ({ ...th, primary }))} />
            <ColorInput t={generator} label={t.button} value={theme.button} onChange={(button) => onTheme((th) => ({ ...th, button }))} />
          </div>
        </fieldset>
      </div>
      {preview && (
        <div className="md:sticky md:top-[calc(var(--header-h)+1.5rem)]">
          <PagePreview key={type.name} t={t} workspaceId={workspaceId} type={type.name} lang={lang} body={body} onRefused={onRefused} />
        </div>
      )}
    </div>
  );
}

/**
 * Focuses the page control drawn for a path (fields and lists carry it as `data-path`); false
 * when the editor draws none.
 */
export function focusPageField(path: string): boolean {
  const el = Array.from(document.querySelectorAll<HTMLElement>("[data-path]")).find((e) => e.dataset.path === path);
  el?.focus();
  return Boolean(el);
}
