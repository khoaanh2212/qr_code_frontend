import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon: LucideIcon;
  /** What is (not) here, as a heading. */
  title: string;
  /** What to do about it: teach the next step, do not just say "nothing here". */
  children?: ReactNode;
  action?: ReactNode;
  /** Heading level in the page outline. */
  as?: "h2" | "h3";
}

/** A dashed panel for "nothing yet" and "nothing matches", with the way forward. */
export function EmptyState({ icon: Icon, title, children, action, as: Heading = "h2" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6 sm:p-8">
      <Icon aria-hidden="true" className="size-6 text-muted" strokeWidth={1.5} />
      <Heading className="text-lg font-semibold">{title}</Heading>
      {children && <div className="max-w-prose text-sm text-pretty text-muted">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
