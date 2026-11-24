"use client";

import { useCallback, type InputHTMLAttributes } from "react";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "aria-label"> & {
  /** The accessible name. Shown next to the box unless `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  /** Some, not all, of a group is checked ("select all"). Read as "mixed" by screen readers. */
  indeterminate?: boolean;
};

/**
 * A native checkbox (Signal Teal through `accent-color`) inside a 44px label, so the whole area is
 * the target on phones.
 */
export function Checkbox({ label, hideLabel = false, indeterminate = false, className = "", ...props }: CheckboxProps) {
  // `indeterminate` is a DOM property, not an attribute; set it on every render it changes.
  const ref = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = indeterminate;
    },
    [indeterminate],
  );
  return (
    <label className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 text-sm font-medium ${className}`}>
      <input ref={ref} type="checkbox" className="size-4 cursor-pointer" {...props} />
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
    </label>
  );
}
