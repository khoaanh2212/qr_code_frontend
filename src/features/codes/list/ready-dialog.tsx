"use client";

import { Download, Palette, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { redirectToLogin } from "@/features/auth/require-session";
import { localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import type { QrFormat } from "@/lib/qr/types";
import { getCode } from "../api";
import { displayUrl } from "./code-card";
import { CodeThumbnail } from "./code-thumbnail";

type Load = { kind: "loading" } | { kind: "ready"; code: DynamicCode } | { kind: "failed" };

/**
 * Greets a code that was just created (the list is opened with `?ready={id}`): the code large on
 * white, its short link, downloads, and the way to its design. A modal `<dialog>`, so focus is
 * held and Escape closes it. The id comes from the address: it is only ever sent to the API for
 * this workspace, and what comes back is rendered as text.
 */
export function ReadyDialog({
  t,
  locale,
  workspaceId,
  id,
  code: given,
  title,
  onDownload,
  onClose,
}: {
  t: Messages["codes"];
  locale: Locale;
  workspaceId: string;
  /** The code to load (a code just created), or `code` when the page already has it. */
  id?: string;
  code?: DynamicCode;
  /** Another title than "Your code is ready" (the Download button of a code's page). */
  title?: string;
  onDownload: (code: DynamicCode, format: QrFormat) => void;
  onClose: () => void;
}) {
  const r = t.ready;
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const introId = useId();
  const [load, setLoad] = useState<Load>(() => (given ? { kind: "ready", code: given } : { kind: "loading" }));

  // Opened once it is in the page. No close on cleanup: an unmounted dialog leaves the page with
  // its element, and closing here would queue a `close` event that, in development (StrictMode
  // runs effects twice), arrives after the dialog reopened and dismisses it.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (given || !id) return;
    const abort = new AbortController();
    getCode(workspaceId, id, abort.signal)
      .then((code) => setLoad(code ? { kind: "ready", code } : { kind: "failed" }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setLoad({ kind: "failed" });
      });
    return () => abort.abort();
  }, [workspaceId, id, given]);

  const code = load.kind === "ready" ? load.code : null;
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={introId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        // The browser closed it on its own (a repeated Escape): bring the state in line.
        if (!ref.current?.open) onClose();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_8px_24px_rgb(0_0_0/0.12)] backdrop:bg-black/40"
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="-mt-3 -mr-3 self-end">
          <IconButton label={r.close} icon={X} onClick={onClose} />
        </div>
        <div className="-mt-8 flex flex-col gap-1">
          {/* A code that cannot be shown is not announced as ready. */}
          <h2 id={titleId} className="text-lg font-semibold text-balance">
            {load.kind === "failed" ? t.loadFailed : (title ?? r.title)}
          </h2>
          <p id={introId} className="text-sm text-pretty text-muted">
            {load.kind === "failed" ? "" : r.intro}
          </p>
        </div>
        {load.kind === "failed" ? null : code ? (
          <>
            <CodeThumbnail workspaceId={workspaceId} code={code} className="w-48" />
            <p className="max-w-full truncate font-mono text-sm" title={code.short_url}>
              {displayUrl(code.short_url)}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={() => onDownload(code, "png")}>
                <Download aria-hidden="true" className="size-4" />
                {t.list.downloadPng}
              </Button>
              <Button variant="secondary" onClick={() => onDownload(code, "svg")}>
                <Download aria-hidden="true" className="size-4" />
                {t.list.downloadSvg}
              </Button>
              <Button variant="secondary" onClick={() => onDownload(code, "eps")}>
                <Download aria-hidden="true" className="size-4" />
                {t.list.downloadEps}
              </Button>
            </div>
            <Link
              href={localizePath(locale, `/app/codes/${encodeURIComponent(code.id)}/design`)}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline underline-offset-4 hover:no-underline"
            >
              <Palette aria-hidden="true" className="size-4" />
              {r.customize}
            </Link>
          </>
        ) : (
          <Skeleton className="size-48" />
        )}
      </div>
    </dialog>
  );
}
