import { Search } from "lucide-react";
import { useId, type InputHTMLAttributes, type Ref } from "react";

export type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  /** Accessible name (visually hidden: the icon and placeholder carry it on screen). */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  ref?: Ref<HTMLInputElement>;
};

/** A search box (DESIGN.md "Inputs"): leading icon, native clear button, 44px tall. */
export function SearchField({ label, value, onValueChange, className = "", ref, ...props }: SearchFieldProps) {
  const id = useId();
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 w-full rounded-md border border-control bg-surface pr-3 pl-9 text-base placeholder:text-muted sm:text-sm"
        {...props}
      />
    </div>
  );
}
