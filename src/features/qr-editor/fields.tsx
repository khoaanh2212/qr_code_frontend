"use client";

import type { Messages } from "@/i18n/messages";
import { isOpenWifi } from "@/lib/qr/render-request";
import { isToggle, type QrData, type QrField, type QrType } from "@/lib/qr/types";

type T = Messages["generator"];
type FieldText = { label: string; help: string };

/** Own-property lookup: names come from the API and must not reach Object.prototype. */
export function lookup<V>(table: object, key: string): V | undefined {
  return Object.hasOwn(table, key) ? (table as Record<string, V>)[key] : undefined;
}

/** Translated label and help of a field; the API's English description for unknown fields. */
export function fieldText(t: T, type: string, field: QrField): FieldText {
  const fields = lookup<object>(t.fields, type);
  const known = fields ? lookup<FieldText>(fields, field.name) : undefined;
  return known ?? { label: field.name, help: field.description ?? "" };
}

function inputType(name: string): { type: string; inputMode?: "url" | "email" | "tel"; autoComplete?: string } {
  if (name === "url" || name === "website") return { type: "url", inputMode: "url", autoComplete: "url" };
  if (name === "email" || name === "to") return { type: "email", inputMode: "email", autoComplete: "email" };
  if (name === "phone") return { type: "tel", inputMode: "tel", autoComplete: "tel" };
  return { type: "text", autoComplete: "off" };
}

/** Initial values of a type: selects start at their first option. */
export function initialData(type: QrType): QrData {
  const data: QrData = {};
  for (const f of type.fields) {
    if (f.options && !isToggle(f)) data[f.name] = f.options[0];
  }
  return data;
}

const control =
  "w-full rounded-md border border-control bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted aria-[invalid=true]:border-danger";

export function ContentFields({
  t,
  qrType,
  data,
  errors,
  onChange,
  onBlur,
}: {
  t: T;
  qrType: QrType;
  data: QrData;
  /** Error message per field name. */
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
  onBlur: (name: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {qrType.fields.map((field) => {
        // An open network has no password to enter.
        if (field.name === "password" && isOpenWifi(qrType.type, data)) return null;
        const id = `qr-${qrType.type}-${field.name}`;
        const text = fieldText(t, qrType.type, field);
        const error = errors[field.name];
        const describedBy = [text.help && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
        const value = data[field.name] ?? "";
        const wide = field.multiline || qrType.fields.length === 1 || field.name === "url" || field.name === "website";

        if (isToggle(field)) {
          return (
            <div key={field.name} className="flex items-center gap-2 self-end py-2 sm:col-span-2">
              <input
                id={id}
                type="checkbox"
                className="size-4 accent-accent"
                checked={value === "true"}
                onChange={(e) => onChange(field.name, e.target.checked ? "true" : "")}
              />
              <label htmlFor={id} className="text-sm">
                {text.label}
              </label>
            </div>
          );
        }

        const common = {
          id,
          name: field.name,
          value,
          required: field.required,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": describedBy,
          onBlur: () => onBlur(field.name),
          className: control,
        };

        let input: React.ReactNode;
        if (field.options) {
          const options = t.options;
          input = (
            <select {...common} onChange={(e) => onChange(field.name, e.target.value)}>
              {field.options.map((o) => (
                <option key={o} value={o}>
                  {lookup<string>(options, o) ?? o}
                </option>
              ))}
            </select>
          );
        } else if (field.multiline) {
          input = (
            <textarea {...common} rows={4} maxLength={field.max_length} onChange={(e) => onChange(field.name, e.target.value)} />
          );
        } else {
          input = (
            <input
              {...common}
              {...inputType(field.name)}
              maxLength={field.max_length}
              spellCheck={false}
              onChange={(e) => onChange(field.name, e.target.value)}
            />
          );
        }

        return (
          <div key={field.name} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
            <label htmlFor={id} className="text-sm font-medium">
              {text.label}
              {(field.required || (field.name === "password" && qrType.type === "wifi")) && (
                <span aria-hidden="true" className="text-danger">
                  {" "}
                  *
                </span>
              )}
            </label>
            {input}
            {text.help && (
              <p id={`${id}-help`} className="text-xs text-muted">
                {text.help}
              </p>
            )}
            {error && (
              <p id={`${id}-error`} className="text-xs font-medium text-danger">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
