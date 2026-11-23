"use client";

import { CircleCheck, CircleX, MailCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { safeReturnTo } from "@/lib/navigation/return-to";

/** The one alert of a form: what went wrong with the submission as a whole. */
export function FormAlert({ message }: { message?: string }) {
  return (
    <p role="alert" className="text-sm font-medium text-danger empty:hidden">
      {message ?? ""}
    </p>
  );
}

export type NoticeTone = "success" | "sent" | "warning" | "danger" | "neutral";

const TONES: Record<NoticeTone, { icon: LucideIcon | null; className: string; iconClass: string }> = {
  success: { icon: CircleCheck, className: "border-accent/40", iconClass: "text-accent" },
  sent: { icon: MailCheck, className: "border-accent/40", iconClass: "text-accent" },
  warning: { icon: TriangleAlert, className: "border-warning/50", iconClass: "text-warning" },
  danger: { icon: CircleX, className: "border-danger/50", iconClass: "text-danger" },
  neutral: { icon: null, className: "border-border", iconClass: "" },
};

/**
 * What a form turned into once it has done its job (or what a link page found). The tone is
 * carried by an icon and the border, never by color alone. It takes focus when it appears: the
 * control that had focus is gone, and screen readers read it from there. No focus ring: it is
 * not a control (DESIGN.md, The Two Edges Rule).
 */
export function Notice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const { icon: Icon, className, iconClass } = TONES[tone];
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className={`flex gap-3 rounded-lg border bg-surface p-5 outline-none ${className}`}
    >
      {Icon && <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${iconClass}`} />}
      <div className="flex min-w-0 flex-col gap-3">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        <div className="flex flex-col gap-3 text-sm text-pretty">{children}</div>
      </div>
    </div>
  );
}

/** The next step after an outcome, as the area's primary action (DESIGN.md "Buttons"). */
export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-4 font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
    >
      {children}
    </Link>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

/** `path` with the return_to of `search` kept, when it is safe. */
export function withReturnTo(path: string, search = typeof window === "undefined" ? "" : window.location.search): string {
  const returnTo = safeReturnTo(new URLSearchParams(search).get("return_to"), "");
  return returnTo ? `${path}?return_to=${encodeURIComponent(returnTo)}` : path;
}

const noSubscribe = () => () => {};

/** A link to another auth page that keeps return_to (the server renders it without). */
export function ReturnToLink({ href, children }: { href: string; children: ReactNode }) {
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  return <TextLink href={withReturnTo(href, search)}>{children}</TextLink>;
}
