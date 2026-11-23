"use client";

import { Check, Download, QrCode } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { RenderRequest } from "@/lib/qr/render-request";
import { SIZE_MAX, SIZE_MIN, type QrFormat } from "@/lib/qr/types";
import { errorText } from "./error-text";
import { render, type PreviewState } from "./use-render";

type T = Messages["generator"];

/** Why no printable code can be shown. */
export type Blocker = "incomplete" | "invalid" | "lowContrast" | null;

/** Saves a blob under `filename` through a temporary link. */
function save(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/** Crop-mark color: the proof frame says whether what it holds can be printed. */
const MARKS = {
  ready: "border-foreground/40",
  blocked: "border-warning/70",
  error: "border-danger/70",
} as const;

export function PreviewPanel({
  t,
  preview,
  blocker,
  invalidLabel,
  contentKey,
  buildDownload,
  filename,
}: {
  t: T;
  preview: PreviewState;
  blocker: Blocker;
  /** Label of the field that blocks the code, for "invalid". */
  invalidLabel?: string;
  /** Changes whenever the content or design changes; clears download messages. */
  contentKey: string;
  /** The POST request of a download in the chosen format and size. */
  buildDownload: (format: QrFormat, size: number) => RenderRequest;
  /** File name without extension. */
  filename: string;
}) {
  const ids = { size: useId(), sizeHelp: useId() };
  const [fmt, setFmt] = useState<QrFormat>("png");
  const [size, setSize] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "saved" | "error"; text: string } | null>(null);
  const [noticeFor, setNoticeFor] = useState(contentKey);
  const latestKey = useRef(contentKey);
  useEffect(() => {
    latestKey.current = contentKey;
  }, [contentKey]);
  // A message about the previous content must not linger after an edit.
  if (noticeFor !== contentKey) {
    setNoticeFor(contentKey);
    setNotice(null);
  }

  const sizeOk = Number.isInteger(size) && size >= SIZE_MIN && size <= SIZE_MAX;
  // Only a refused content blocks printing; a network hiccup on the preview does not stop a
  // download that may well succeed.
  const refused = preview.error?.code === "validation_error";
  const printable = blocker === null && !refused;
  const showImage = printable && preview.src !== null;

  let message = "";
  if (blocker === "incomplete") message = t.preview.empty;
  else if (blocker === "invalid") message = invalidLabel ? format(t.preview.fixField, { field: invalidLabel }) : t.validation.invalid;
  else if (blocker === "lowContrast") message = t.design.lowContrast;
  else if (preview.error) message = errorText(preview.error, t);

  const marks = blocker !== null ? MARKS.blocked : preview.error ? MARKS.error : MARKS.ready;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">{t.preview.title}</h2>

      {/* Crop marks frame the code like a print proof; their color carries its state. */}
      <div aria-busy={blocker === null && preview.pending} className="relative mx-auto aspect-square w-full max-w-72 p-3">
        <span aria-hidden="true" className={`absolute top-0 left-0 size-4 border-t-2 border-l-2 transition-colors duration-200 ${marks}`} />
        <span aria-hidden="true" className={`absolute top-0 right-0 size-4 border-t-2 border-r-2 transition-colors duration-200 ${marks}`} />
        <span aria-hidden="true" className={`absolute bottom-0 left-0 size-4 border-b-2 border-l-2 transition-colors duration-200 ${marks}`} />
        <span aria-hidden="true" className={`absolute right-0 bottom-0 size-4 border-r-2 border-b-2 transition-colors duration-200 ${marks}`} />
        <div className="flex size-full items-center justify-center overflow-hidden rounded-sm bg-white">
          {showImage ? (
            // A blob: URL from the API; next/image cannot optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.src ?? undefined}
              alt={t.preview.alt}
              className={`size-full object-contain transition-opacity duration-200 ${preview.pending ? "opacity-50" : "opacity-100"}`}
            />
          ) : (
            <QrCode aria-hidden="true" className="size-20 text-stone-300" strokeWidth={1.25} />
          )}
        </div>
      </div>

      {/* The proof's spec line: what the download will be. */}
      <p className="-mt-2 text-center font-mono text-xs text-muted tabular-nums">
        {fmt.toUpperCase()} · {sizeOk ? `${size} × ${size} px` : "—"}
      </p>

      <p
        role="status"
        className={`min-h-5 text-center text-sm text-pretty ${preview.error && blocker === null ? "font-medium text-danger" : "text-muted"}`}
      >
        {message}
      </p>
      {blocker === null && preview.pending && !preview.error && (
        <p aria-hidden="true" className="-mt-4 text-center text-xs text-muted">
          {t.preview.updating}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <h2 className="text-lg font-semibold">{t.sections.download}</h2>
        <div className="flex flex-wrap items-start gap-4">
          <fieldset className="flex flex-col">
            <legend className="mb-1.5 text-sm font-medium">{t.download.format}</legend>
            <div className="flex overflow-hidden rounded-md border border-control">
              {(["png", "svg"] as const).map((f) => (
                <label
                  key={f}
                  className="inline-flex min-h-11 cursor-pointer items-center px-4 font-mono text-sm uppercase has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent"
                >
                  <input type="radio" name="qr-format" value={f} checked={fmt === f} onChange={() => setFmt(f)} className="sr-only" />
                  {f}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.size} className="text-sm font-medium">
              {t.download.size}
            </label>
            <input
              id={ids.size}
              type="number"
              inputMode="numeric"
              min={SIZE_MIN}
              max={SIZE_MAX}
              step={1}
              value={Number.isNaN(size) ? "" : size}
              aria-invalid={sizeOk ? undefined : true}
              aria-describedby={ids.sizeHelp}
              onChange={(e) => setSize(e.target.valueAsNumber)}
              className="min-h-11 w-28 rounded-md border border-control bg-surface px-3 font-mono text-sm tabular-nums aria-[invalid=true]:border-danger"
            />
            <p id={ids.sizeHelp} className={`text-xs ${sizeOk ? "text-muted" : "font-medium text-danger"}`}>
              {format(t.download.sizeHelp, { min: SIZE_MIN, max: SIZE_MAX })}
            </p>
          </div>
        </div>
        <button
          type="button"
          data-qr-download
          disabled={!printable || !sizeOk || busy}
          onClick={async () => {
            setBusy(true);
            setNotice(null);
            const file = `${filename}.${fmt}`;
            const startedFor = contentKey;
            try {
              const blob = await render(buildDownload(fmt, size));
              save(blob, file);
              // The content may have changed while the file was rendering: say nothing then.
              if (latestKey.current === startedFor) setNotice({ kind: "saved", text: format(t.download.saved, { file }) });
            } catch (err) {
              const error = err instanceof ApiError ? err : new ApiError(0, "network_error", "");
              if (latestKey.current === startedFor) setNotice({ kind: "error", text: errorText(error, t) });
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download aria-hidden="true" className="size-4" />
          {busy ? t.download.working : format(t.download.button, { format: fmt.toUpperCase() })}
        </button>
        {/* Two live regions that stay mounted: one polite, one for errors. */}
        <p role="status" className="flex min-h-5 items-start gap-1.5 text-sm break-words text-muted">
          {notice?.kind === "saved" && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />}
          {notice?.kind === "saved" ? <span className="min-w-0">{notice.text}</span> : null}
        </p>
        <p role="alert" className="-mt-3 text-sm font-medium break-words text-danger empty:hidden">
          {notice?.kind === "error" ? notice.text : ""}
        </p>
      </div>
    </div>
  );
}
