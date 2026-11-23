import { useId, type ReactNode } from "react";

/**
 * One settings section: heading and explanation on the left, the controls on the right
 * (stacked on phones). The danger variant frames irreversible actions in Stop Red.
 */
export function Section({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`grid gap-4 border-t py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10 ${danger ? "border-danger/40" : "border-border"}`}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className={`text-lg font-semibold ${danger ? "text-danger" : ""}`}>
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
    <p role="status" className="min-h-5 text-sm text-pretty text-muted">
      {message ?? ""}
    </p>
  );
}
