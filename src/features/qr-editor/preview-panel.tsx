"use client";

import { Download } from "lucide-react";
import { useId, useState } from "react";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { RenderRequest } from "@/lib/qr/render-request";
import { SIZE_MAX, SIZE_MIN, type QrFormat } from "@/lib/qr/types";
import { errorText } from "./error-text";
import { render, type PreviewState } from "./use-render";

type T = Messages["generator"];

/** Why nothing can be rendered yet. */
export type Blocker = "incomplete" | "lowContrast" | null;

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

export function PreviewPanel({
  t,
  preview,
  blocker,
  buildDownload,
  filename,
}: {
  t: T;
  preview: PreviewState;
  blocker: Blocker;
  /** The POST request of a download in the chosen format and size. */
  buildDownload: (format: QrFormat, size: number) => RenderRequest;
  filename: string;
}) {
  const ids = { size: useId(), sizeHelp: useId() };
  const [fmt, setFmt] = useState<QrFormat>("png");
  const [size, setSize] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const sizeOk = Number.isInteger(size) && size >= SIZE_MIN && size <= SIZE_MAX;
  const ready = blocker === null;

  // Announced: what blocks the preview, or why it failed. "Updating" is shown, not announced:
  // it would be read out on every pause in typing.
  let message = "";
  let isError = false;
  if (blocker === "incomplete") message = t.preview.empty;
  else if (blocker === "lowContrast") message = t.design.lowContrast;
  else if (preview.error) {
    message = errorText(preview.error, t);
    isError = true;
  }

  const stale = preview.pending || Boolean(preview.error) || !ready;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold">{t.preview.title}</h2>

      {/* Crop marks frame the code like a print proof. */}
      <div aria-busy={ready && preview.pending} className="relative mx-auto aspect-square w-full max-w-72 p-3">
        <span aria-hidden="true" className="absolute top-0 left-0 size-4 border-t-2 border-l-2 border-foreground/40" />
        <span aria-hidden="true" className="absolute top-0 right-0 size-4 border-t-2 border-r-2 border-foreground/40" />
        <span aria-hidden="true" className="absolute bottom-0 left-0 size-4 border-b-2 border-l-2 border-foreground/40" />
        <span aria-hidden="true" className="absolute right-0 bottom-0 size-4 border-r-2 border-b-2 border-foreground/40" />
        <div className="flex size-full items-center justify-center overflow-hidden rounded-sm bg-surface">
          {preview.src && ready ? (
            // A blob: URL from the API; next/image cannot optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.src}
              alt={t.preview.alt}
              className={`size-full object-contain transition-opacity duration-200 ${stale ? "opacity-40" : "opacity-100"}`}
            />
          ) : (
            <div aria-hidden="true" className="grid size-2/3 grid-cols-3 gap-2 opacity-15">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className={`rounded-sm bg-foreground ${i % 2 ? "opacity-0" : ""}`} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The proof's spec line: what the download will be. */}
      <p className="-mt-2 text-center font-mono text-xs text-muted tabular-nums">
        {fmt.toUpperCase()} · {sizeOk ? `${size} × ${size} px` : "—"}
      </p>

      <p role="status" className={`min-h-5 text-center text-sm ${isError ? "font-medium text-danger" : "text-muted"}`}>
        {message}
      </p>
      {ready && preview.pending && !preview.error && (
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
                  className="cursor-pointer px-3 py-2 font-mono text-sm uppercase has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent"
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
              className="w-28 rounded-md border border-control bg-surface px-3 py-2 font-mono text-sm tabular-nums aria-[invalid=true]:border-danger"
            />
            <p id={ids.sizeHelp} className={`text-xs ${sizeOk ? "text-muted" : "font-medium text-danger"}`}>
              {format(t.download.sizeHelp, { min: SIZE_MIN, max: SIZE_MAX })}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!ready || !sizeOk || busy}
          onClick={async () => {
            setBusy(true);
            setDownloadError(null);
            try {
              save(await render(buildDownload(fmt, size)), `${filename}.${fmt}`);
            } catch (err) {
              setDownloadError(errorText(err instanceof ApiError ? err : new ApiError(0, "network_error", ""), t));
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download aria-hidden="true" className="size-4" />
          {busy ? t.download.working : format(t.download.button, { format: fmt.toUpperCase() })}
        </button>
        {downloadError && (
          <p role="alert" className="text-sm font-medium text-danger">
            {downloadError}
          </p>
        )}
      </div>
    </div>
  );
}
