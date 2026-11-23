import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40";
const variants: Record<Variant, string> = {
  // DESIGN.md: one Signal Teal button per area, 48px tall.
  primary: "min-h-12 bg-accent px-4 text-accent-foreground hover:opacity-90",
  secondary: "min-h-11 border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
