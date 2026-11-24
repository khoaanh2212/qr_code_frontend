"use client";

import { ChevronDown, Shapes } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError, sessionApi } from "@/lib/api";
import type { CodeDesign, MeResponse } from "@/lib/api/types";
import { TemplateBar } from "./template-bar";

type State = { kind: "closed" } | { kind: "loading" } | { kind: "signedOut" } | { kind: "ready"; workspaceId: string } | { kind: "error" };

/**
 * Templates in the public generator. Nothing is requested until the person opens the section;
 * then the session is checked at runtime (the page itself never depends on it): signed in, the
 * template bar appears; signed out, a sign-in link that comes back here.
 */
export function GeneratorTemplates({
  t,
  locale,
  currentDesign,
  onApply,
}: {
  t: Messages["templates"];
  locale: Locale;
  currentDesign: () => CodeDesign;
  onApply: (design: CodeDesign) => void;
}) {
  const pathname = usePathname();
  const [state, setState] = useState<State>({ kind: "closed" });
  // The request of the latest opening; closing (or leaving) aborts it, so a late answer never
  // reopens the section.
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function open() {
    pending.current?.abort();
    if (state.kind !== "closed") {
      pending.current = null;
      setState({ kind: "closed" });
      return;
    }
    const abort = new AbortController();
    pending.current = abort;
    setState({ kind: "loading" });
    try {
      const me = await sessionApi.request<MeResponse>("/v1/me", { signal: abort.signal });
      if (abort.signal.aborted) return;
      const personal = me.workspaces?.find((w) => w.personal);
      setState(personal ? { kind: "ready", workspaceId: personal.id } : { kind: "error" });
    } catch (err) {
      if (abort.signal.aborted) return;
      setState(err instanceof ApiError && err.status === 401 ? { kind: "signedOut" } : { kind: "error" });
    }
  }

  const signedOut = (
    <p className="text-sm">
      {t.signIn}{" "}
      <Link
        href={`${localizePath(locale, "/login")}?return_to=${encodeURIComponent(pathname)}`}
        className="font-medium text-accent underline-offset-4 hover:underline"
      >
        {t.signInLink}
      </Link>
    </p>
  );

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={state.kind !== "closed"}
        onClick={() => void open()}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5"
      >
        <Shapes aria-hidden="true" className="size-4 text-accent" />
        {t.open}
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${state.kind !== "closed" ? "rotate-180" : ""}`} />
      </button>
      {state.kind === "loading" && <p role="status" className="text-sm text-muted">{t.open}…</p>}
      {state.kind === "error" && <p role="alert" className="text-sm font-medium text-danger">{t.errors.generic}</p>}
      {state.kind === "signedOut" && signedOut}
      {state.kind === "ready" && (
        <TemplateBar
          t={t}
          workspaceId={state.workspaceId}
          currentDesign={currentDesign}
          onApply={onApply}
          onUnauthenticated={() => setState({ kind: "signedOut" })}
        />
      )}
    </div>
  );
}
