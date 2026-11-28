"use client";

import { useId } from "react";

/**
 * An on/off setting that takes effect at once (WAI-ARIA switch): one `<button role="switch">`
 * holding the track, the label and an optional help line, so the whole row toggles it (pointer
 * and speech control alike) and is at least a 44px target.
 */
export function Switch({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ids = { label: useId(), help: useId() };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={ids.label}
      aria-describedby={help ? ids.help : undefined}
      onClick={() => onChange(!checked)}
      className="group flex min-h-11 cursor-pointer items-start gap-3 text-left focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={`relative mt-2.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent ${
          checked ? "border-accent bg-accent" : "border-control bg-foreground/10"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-2.5">
        <span id={ids.label} className="text-sm font-medium">
          {label}
        </span>
        {help && (
          <span id={ids.help} className="text-xs text-pretty text-muted">
            {help}
          </span>
        )}
      </span>
    </button>
  );
}
