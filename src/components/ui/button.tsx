import type { ButtonHTMLAttributes, Ref } from "react";

type Variant = "primary" | "secondary" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40";
const variants: Record<Variant, string> = {
  // DESIGN.md: one Signal Teal button per area, 48px tall.
  primary: "min-h-12 bg-accent px-4 text-accent-foreground hover:opacity-90",
  secondary: "min-h-11 border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5",
  // Irreversible actions only (deleting the account), never next to a primary button.
  danger: "min-h-12 bg-danger px-4 text-on-danger hover:opacity-90",
};

/**
 * `busy` keeps the button focusable while a request runs (aria-disabled, activation ignored):
 * a truly disabled button drops keyboard focus to the page in Chrome.
 */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  busy = false,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      type={type}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={(e) => {
        if (busy) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={`${base} ${variants[variant]} aria-disabled:cursor-wait aria-disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
