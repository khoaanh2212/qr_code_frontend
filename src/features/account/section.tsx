import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";

/**
 * One settings section: heading and explanation on the left, the controls on the right
 * (stacked on phones). The danger variant marks irreversible actions with a Stop Red heading.
 */
export function Section({
  title,
  description,
  danger = false,
  anchor,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  /** The section's id, when links lead straight to it (`/app/codes/{id}#design`); its heading then takes focus by script. */
  anchor?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      id={anchor}
      aria-labelledby={id}
      className="grid scroll-mt-4 gap-4 border-t border-border py-8 first:border-t-0 first:pt-4 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={id} tabIndex={anchor ? -1 : undefined} className={`text-lg font-semibold ${danger ? "text-danger" : ""}`}>
          {title}
        </h2>
        {description && <p className="text-sm text-pretty text-muted">{description}</p>}
      </div>
      <div className="flex max-w-md flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * A short confirmation next to a section's button ("Saved."). The live region stays rendered
 * even when empty: one that appears together with its text is often not announced.
 */
export function SavedNote({ message }: { message?: string }) {
  return (
    <p role="status" className="flex min-h-5 items-start gap-1.5 text-sm text-pretty">
      {message && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />}
      {message ?? ""}
    </p>
  );
}
