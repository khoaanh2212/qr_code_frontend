"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import type { Messages } from "@/i18n/messages";
import { SOCIAL_NETWORKS } from "@/lib/qr/social";
import { normalizeUrlInput } from "@/lib/qr/validate";
import { PageUpload } from "./page-upload";
import { editableFields, isUpload, newItem, type DraftItem, type PageDraft, type PageField, type PageTypeInfo } from "./content";

type T = Messages["pages"];

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const INPUT_TYPES: Record<string, { type: string; inputMode?: "url" | "tel" | "email"; autoComplete?: string }> = {
  url: { type: "url", inputMode: "url", autoComplete: "url" },
  video_url: { type: "url", inputMode: "url" },
  phone: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  email: { type: "email", inputMode: "email", autoComplete: "email" },
  date: { type: "date" },
  datetime: { type: "datetime-local" },
  time: { type: "time" },
};

/** A field's words; a field the messages do not know yet reads as its name. */
function labelOf(t: T, name: string): string {
  return (t.fields as Record<string, string>)[name] ?? name.replace(/_/g, " ");
}

/**
 * The content fields of a page type, drawn from its schema (`GET /v1/page-types`): text, long
 * text, links, dates and times, weekdays, time zones, networks and lists of those. Upload fields
 * are not drawn here yet. A refusal shows at its field by the API's path (`links[0].url`).
 */
export function PageFields({
  workspaceId,
  t,
  generator,
  type,
  value,
  onChange,
  errors = {},
}: {
  /** Where uploaded files go. */
  workspaceId: string;
  t: T;
  generator: Messages["generator"];
  type: PageTypeInfo;
  value: PageDraft;
  onChange: (update: (d: PageDraft) => PageDraft) => void;
  errors?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-5">
      {editableFields(type.fields).map((field) =>
        field.kind === "list" ? (
          <ListField
            key={field.name}
            workspaceId={workspaceId}
            t={t}
            generator={generator}
            field={field}
            items={Array.isArray(value[field.name]) ? (value[field.name] as DraftItem[]) : []}
            errors={errors}
            onChange={(update) =>
              onChange((d) => ({ ...d, [field.name]: update(Array.isArray(d[field.name]) ? (d[field.name] as DraftItem[]) : []) }))
            }
          />
        ) : (
          <Field
            key={field.name}
            workspaceId={workspaceId}
            t={t}
            generator={generator}
            field={field}
            path={field.name}
            value={typeof value[field.name] === "string" ? (value[field.name] as string) : ""}
            error={errors[field.name]}
            onChange={(v) => onChange((d) => ({ ...d, [field.name]: v }))}
          />
        ),
      )}
    </div>
  );
}

let nextKey = 0;
const newKey = () => `item-${++nextKey}`;

function ListField({
  workspaceId,
  t,
  generator,
  field,
  path = field.name,
  context,
  items,
  errors,
  onChange,
}: {
  workspaceId: string;
  t: T;
  generator: Messages["generator"];
  field: PageField;
  /** The list's editor path (`sections[1].items` for a list inside an item). */
  path?: string;
  /** The item a list inside an item belongs to ("Sections 2"): its buttons name it, so each is distinct. */
  context?: string;
  items: DraftItem[];
  errors: Record<string, string>;
  onChange: (update: (items: DraftItem[]) => DraftItem[]) => void;
}) {
  const label = labelOf(t, field.name);
  const within = context ? ` (${context})` : "";
  const full = field.max !== undefined && items.length >= field.max;
  const listError = errors[path];
  const errorId = useId();
  const subFields = editableFields(field.items ?? []);
  // Items keep their key when one before them goes (ids, caret and date pickers follow the item).
  const [keys, setKeys] = useState<string[]>(() => items.map(newKey));
  if (keys.length !== items.length) setKeys(items.map((_, i) => keys[i] ?? newKey()));
  // After add or remove, focus moves to the new item, the item that took the removed one's
  // place (or the one before it), or Add when the list is empty.
  const pendingFocus = useRef<number | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    const at = pendingFocus.current;
    if (at === null) return;
    pendingFocus.current = null;
    const first = subFields[0];
    const target =
      at >= 0 && first ? listRef.current?.querySelector<HTMLElement>(`[data-path="${path}[${at}].${first.name}"]`) : null;
    (target ?? addRef.current)?.focus();
  }, [items.length, path, subFields]);

  return (
    <fieldset
      ref={listRef}
      data-path={path}
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-3 focus:outline-none"
      aria-describedby={listError ? errorId : undefined}
    >
      <legend className="mb-1.5 text-sm font-semibold">
        {label}
        {field.required && <span aria-hidden="true"> *</span>}
      </legend>
      {items.map((item, i) => {
        const itemLabel = t.itemLabel.replace("{label}", label).replace("{n}", String(i + 1));
        return (
          <fieldset key={keys[i] ?? i} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
            <legend className="sr-only">{itemLabel}</legend>
            {subFields.map((sub) => {
              const at = `${path}[${i}].${sub.name}`;
              const set = (v: DraftItem[string]) => onChange((list) => list.map((it, j) => (j === i ? { ...it, [sub.name]: v } : it)));
              const inner = item[sub.name];
              return sub.kind === "list" ? (
                // A list inside the item (a menu section's dishes).
                <ListField
                  key={sub.name}
                  workspaceId={workspaceId}
                  t={t}
                  generator={generator}
                  field={sub}
                  path={at}
                  context={itemLabel}
                  items={Array.isArray(inner) ? inner : []}
                  errors={errors}
                  onChange={(update) =>
                    onChange((list) =>
                      list.map((it, j) => (j === i ? { ...it, [sub.name]: update(Array.isArray(it[sub.name]) ? (it[sub.name] as DraftItem[]) : []) } : it)),
                    )
                  }
                />
              ) : (
                <Field
                  key={sub.name}
                  workspaceId={workspaceId}
                  t={t}
                  generator={generator}
                  field={sub}
                  path={at}
                  value={typeof inner === "string" ? inner : ""}
                  error={errors[at]}
                  onChange={set}
                />
              );
            })}
            <button
              type="button"
              aria-label={`${t.remove}: ${itemLabel}${within}`}
              onClick={() => {
                setKeys((k) => k.filter((_, j) => j !== i));
                pendingFocus.current = items.length > 1 ? Math.min(i, items.length - 2) : -1;
                onChange((list) => list.filter((_, j) => j !== i));
              }}
              className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted hover:bg-foreground/5 hover:text-foreground"
            >
              <X aria-hidden="true" className="size-4" />
              {t.remove}
            </button>
          </fieldset>
        );
      })}
      <button
        ref={addRef}
        type="button"
        disabled={full}
        aria-label={`${t.add}: ${label}${within}`}
        onClick={() => {
          setKeys((k) => [...k, newKey()]);
          pendingFocus.current = items.length;
          onChange((list) => [...list, newItem(field)]);
        }}
        className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
      >
        <Plus aria-hidden="true" className="size-4" />
        {t.add}
      </button>
      {listError && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {listError}
        </p>
      )}
    </fieldset>
  );
}

function Field({
  workspaceId,
  t,
  generator,
  field,
  path,
  value,
  error,
  onChange,
}: {
  workspaceId: string;
  t: T;
  generator: Messages["generator"];
  field: PageField;
  path: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const label = labelOf(t, field.name);
  const ids = { area: useId(), help: useId() };
  const zones = useMemo(() => {
    if (field.kind !== "timezone") return [];
    const known = timeZones();
    // A zone the browser does not list (UTC in some engines) stays choosable as it is.
    return value && !known.includes(value) ? [value, ...known] : known;
  }, [field.kind, value]);

  if (isUpload(field)) {
    return (
      <PageUpload
        t={t}
        workspaceId={workspaceId}
        label={label}
        fieldKind={field.kind}
        path={path}
        required={field.required}
        value={value}
        error={error}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "weekday") {
    return (
      <Select
        stacked
        label={label}
        dataPath={path}
        value={value}
        options={WEEKDAYS.map((d) => ({ value: d, label: t.weekdays[d] }))}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "timezone") {
    return (
      <Select
        stacked
        label={label}
        dataPath={path}
        value={value}
        options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "social_network") {
    return (
      <Select
        stacked
        label={label}
        dataPath={path}
        value={value}
        options={SOCIAL_NETWORKS.map((n) => ({ value: n, label: generator.options[n] }))}
        onChange={onChange}
      />
    );
  }
  if (field.kind === "multiline") {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.area} className="text-sm font-medium">
          {label}
          {field.required && <span aria-hidden="true"> *</span>}
        </label>
        <textarea
          id={ids.area}
          name={path}
          data-path={path}
          rows={3}
          required={field.required}
          maxLength={field.max}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.help : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-control bg-surface px-3 py-2 text-base aria-[invalid=true]:border-danger"
        />
        {error && (
          <p id={ids.help} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
  const input = INPUT_TYPES[field.kind] ?? { type: "text" };
  const isUrl = field.kind === "url" || field.kind === "video_url";
  return (
    <TextField
      label={label}
      name={path}
      data-path={path}
      required={field.required}
      maxLength={field.max}
      type={input.type}
      inputMode={input.inputMode}
      autoComplete={input.autoComplete ?? "off"}
      spellCheck={isUrl ? false : undefined}
      value={value}
      error={error}
      onChange={(e) => onChange(e.target.value)}
      onBlur={
        isUrl
          ? () => {
              const normalized = value && normalizeUrlInput(value);
              if (normalized !== value) onChange(normalized);
            }
          : undefined
      }
    />
  );
}

/** The time zones the browser knows, or UTC alone where it lists none. */
function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}
