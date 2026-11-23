"use client";

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

/**
 * What a form turned into once it has done its job (or what a link page found). It takes focus
 * when it appears: the control that had focus is gone, and screen readers read it from there.
 */
export function Notice({ title, children }: { title?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 focus:outline-none focus-visible:outline-2"
    >
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      <div className="flex flex-col gap-3 text-sm text-pretty">{children}</div>
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
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
