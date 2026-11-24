import type { LucideIcon } from "lucide-react";
import { useId } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for screen readers (always visually hidden). */
  legend: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Show only the icons; the labels stay as accessible names and tooltips. */
  hideLabels?: boolean;
}

/**
 * Two or three mutually exclusive options (DESIGN.md "Segmented Toggle"). Native radios underneath,
 * so arrow keys move the choice and the form semantics are free; the selected segment is ink
 * filled with paper text.
 */
export function SegmentedControl<T extends string>({ legend, value, options, onChange, hideLabels = false }: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="inline-flex rounded-md border border-control p-0.5">
      <legend className="sr-only">{legend}</legend>
      {options.map(({ value: v, label, icon: Icon }) => (
        <label
          key={v}
          title={hideLabels ? label : undefined}
          className="relative inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[4px] px-2.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
        >
          <input
            type="radio"
            name={name}
            value={v}
            checked={v === value}
            onChange={() => onChange(v)}
            className="peer absolute inset-0 cursor-pointer opacity-0"
          />
          {Icon && <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />}
          <span className={hideLabels ? "sr-only" : undefined}>{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
