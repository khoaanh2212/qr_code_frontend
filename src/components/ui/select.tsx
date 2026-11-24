import { ChevronDown } from "lucide-react";
import { useId } from "react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  label: string;
  /** Keep the label for screen readers only (a toolbar where the options speak for themselves). */
  hideLabel?: boolean;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A native select: the platform's own picker on phones, full keyboard support everywhere. Typed by
 * its option values, so `onChange` never hands back a string outside them.
 */
export function Select<T extends string>({ label, hideLabel = false, value, options, onChange, className = "" }: SelectProps<T>) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-sm font-medium text-muted"}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => {
            const next = options.find((o) => o.value === e.target.value);
            if (next) onChange(next.value);
          }}
          className="min-h-11 w-full cursor-pointer appearance-none rounded-md border border-control bg-surface pr-9 pl-3 text-sm font-medium"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
