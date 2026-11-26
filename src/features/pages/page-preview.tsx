"use client";

import { useEffect, useEffectEvent, useState } from "react";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { previewPage, sampleUrl } from "./api";
import { contentPath, type PageBody } from "./content";

const DEBOUNCE_MS = 500;

/** The last answer, for the page it was drawn for; a failure keeps the page drawn before it. */
type Result = { key: string; html: string | null; failed: boolean };

/**
 * A page as a phone shows it. Until its required fields are filled (`body` null) it is the
 * type's sample (`GET /v1/page-types/{type}/sample`); then the API draws the page itself
 * (POST .../pages/preview) once typing pauses. Both run in a sandboxed frame without scripts:
 * the sample by its URL on the API, the preview as `srcdoc`.
 */
export function PagePreview({
  t,
  workspaceId,
  type,
  lang,
  body,
  onRefused,
}: {
  t: Messages["pages"];
  workspaceId: string;
  type: string;
  lang: string;
  body: PageBody | null;
  /** A content field the API refused while drawing (its editor path, `links[0].url`). */
  onRefused?: (path: string) => void;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const key = body ? JSON.stringify(body) : null;
  const refused = useEffectEvent((path: string) => onRefused?.(path));

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      previewPage(workspaceId, JSON.parse(key) as PageBody, controller.signal)
        .then((html) => {
          if (!controller.signal.aborted) setResult({ key, html, failed: false });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setResult((prev) => ({ key, html: prev?.html ?? null, failed: true }));
          const path = err instanceof ApiError ? contentPath(err.field) : undefined;
          if (path) refused(path);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, workspaceId]);

  const settled = key !== null && result?.key === key;
  // The editor keys this preview by type, so an earlier answer is always of the same type.
  const html = key !== null ? (result?.html ?? undefined) : undefined;
  const note = key === null ? t.sampleNote : !settled ? t.previewLoading : result.failed ? t.previewFailed : "";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative aspect-[9/19] w-full max-w-[18rem] overflow-hidden rounded-[2.25rem] border-[10px] border-foreground bg-white shadow-lg">
        {key === null || html === undefined ? (
          <iframe
            key={`sample-${type}-${lang}`}
            title={t.sampleFrame}
            src={sampleUrl(type, lang)}
            sandbox=""
            loading="lazy"
            className="size-full border-0"
          />
        ) : (
          <iframe title={t.previewFrame} sandbox="" srcDoc={html} className="size-full border-0" />
        )}
      </div>
      {/* Only a failure is announced: "drawing" after every pause in typing would be noise. */}
      <p className="max-w-[18rem] text-center text-xs text-pretty text-muted">
        <span aria-hidden={note !== t.previewFailed}>{note}</span>
      </p>
      <p role="status" className="sr-only">
        {note === t.previewFailed ? note : ""}
      </p>
    </div>
  );
}
