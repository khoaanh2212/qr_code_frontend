import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, Ref } from "react";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  /** The accessible name, also shown as the tooltip. Required: an icon alone names nothing. */
  label: string;
  icon: LucideIcon;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * A button that shows only an icon. 44px square (DESIGN.md touch targets), no border at rest so a
 * row of them stays quiet; hover adds the secondary button's 5% ink tint.
 */
export function IconButton({ label, icon: Icon, className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-expanded:bg-foreground/5 aria-expanded:text-foreground ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
    </button>
  );
}
