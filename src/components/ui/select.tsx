import { useId } from "react";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Options that follow each other with the same group are shown under it as a heading. */
  group?: string;
}

export interface SelectProps<T extends string> {
  label: string;
  /** Keep the label for screen readers only (a toolbar where the options speak for themselves). */
  hideLabel?: boolean;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** Label above the select, as a form field has it (default: beside it, for toolbars). */
  stacked?: boolean;
  className?: string;
}

/** Runs of options that share a group, in order; ungrouped options are runs of their own. */
function runs<T extends string>(options: readonly SelectOption<T>[]): { group?: string; options: SelectOption<T>[] }[] {
  const out: { group?: string; options: SelectOption<T>[] }[] = [];
  for (const o of options) {
    const last = out.at(-1);
    if (last && o.group !== undefined && last.group === o.group) last.options.push(o);
    else out.push({ group: o.group, options: [o] });
  }
  return out;
}

/**
 * A native select: the platform's own picker on phones, full keyboard support everywhere. Typed by
 * its option values, so `onChange` never hands back a string outside them. Options may be grouped
 * (native `<optgroup>`s). The chevron, height and
 * right padding come from the global `select` style (src/styles/globals.css), shared with every
 * other select.
 */
export function Select<T extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  stacked = false,
  className = "",
}: SelectProps<T>) {
  const id = useId();
  const item = (o: SelectOption<T>) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  );
  return (
    <div className={`flex ${stacked ? "flex-col gap-1.5" : "items-center gap-2"} ${className}`}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : stacked ? "text-sm font-medium" : "text-sm font-medium text-muted"}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) onChange(next.value);
        }}
        className="w-full rounded-md border border-control bg-surface text-sm font-medium"
      >
        {runs(options).map((run, i) =>
          run.group === undefined ? (
            run.options.map(item)
          ) : (
            // Keyed by position too: a group named twice, apart, is two groups.
            <optgroup key={`${i}:${run.group}`} label={run.group}>
              {run.options.map(item)}
            </optgroup>
          ),
        )}
      </select>
    </div>
  );
}
