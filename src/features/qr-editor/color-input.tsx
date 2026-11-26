"use client";

import { useId, useState } from "react";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { normalizeHex } from "@/lib/qr/color";

type T = Messages["generator"];

/** A color as a picker plus a hex field that accepts what the user types. */
export function ColorInput({
  t,
  label,
  value,
  onChange,
  disabled = false,
}: {
  t: T;
  label: string;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const ids = { text: useId(), error: useId() };
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  // Follow changes made elsewhere (the picker), but never rewrite what the user is typing
  // when it already means the current color.
  if (synced !== value) {
    setSynced(value);
    if (normalizeHex(text) !== value) setText(value);
  }
  // A field turned off (a transparent background) drops what was being typed and its error.
  if (disabled && text !== value) setText(value);
  const invalid = normalizeHex(text) === null;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={ids.text} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={format(t.design.colorPicker, { name: label })}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-control bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <input
          id={ids.text}
          value={text}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? ids.error : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => {
            if (invalid) setText(value);
          }}
          className="w-28 rounded-md border border-control bg-surface px-3 py-2 font-mono text-sm uppercase disabled:opacity-40 aria-[invalid=true]:border-danger"
        />
      </div>
      {invalid && (
        <p id={ids.error} className="text-xs font-medium text-danger">
          {t.design.colorInvalid}
        </p>
      )}
    </div>
  );
}
