"use client";

import { RotateCcw } from "lucide-react";
import { useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useRenderPreview, type PreviewState } from "@/features/qr-editor/use-render";
import type { Messages } from "@/i18n/messages";
import { buildRenderRequest, requestKey } from "@/lib/qr/render-request";
import { DEFAULT_DESIGN } from "@/lib/qr/types";
import { lookScannable, type CodeLook } from "./design";

type T = Messages["codes"];

const PREVIEW_SIZE = 512;
export const PREVIEW_ID = "code-preview";

/**
 * A live drawing of `look` holding `text` (the code's short link, or a stand-in before it exists),
 * through the render API. Nothing is drawn while `active` is false or the colors are too close.
 */
export function useLookPreview(look: CodeLook, text: string, active = true): { preview: PreviewState; blocked: boolean } {
  const blocked = !lookScannable(look);
  const request = useMemo(
    () =>
      active && !blocked
        ? buildRenderRequest({ type: "url", data: { url: text }, design: { ...DEFAULT_DESIGN, ...look }, format: "png", size: PREVIEW_SIZE })
        : null,
    [active, blocked, look, text],
  );
  return { preview: useRenderPreview(request, request ? requestKey(request) : null), blocked };
}

/**
 * The drawing on white (the Paper Rule), dimmed while the next one loads, with a line about what it
 * shows and a way back to the design it started from.
 */
export function PreviewPane({
  t,
  preview,
  blocked,
  note,
  resetLabel,
  onReset,
  transparent = false,
}: {
  t: T;
  preview: PreviewState;
  blocked: boolean;
  /** The design leaves the background unpainted: drawn over a light checkerboard. */
  transparent?: boolean;
  /** What the drawing stands for; omitted when it is the code itself. */
  note?: string;
  resetLabel: string;
  onReset: () => void;
}) {
  const w = t.wizard;
  const titleId = useId();
  return (
    <section
      id={PREVIEW_ID}
      aria-labelledby={titleId}
      className="flex scroll-mt-4 flex-col items-center gap-3 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)] lg:order-last"
    >
      <h2 id={titleId} className="self-start text-sm font-semibold text-muted">
        {w.previewTitle}
      </h2>
      <div className={`flex aspect-square w-full max-w-64 items-center justify-center rounded-[2px] border border-border p-3 lg:max-w-none ${transparent ? "transparency-grid" : "bg-white"}`}>
        {preview.src && !blocked && (
          // A blob: URL from the API; next/image cannot optimize it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.src}
            alt={w.previewTitle}
            className={`size-full object-contain transition-opacity duration-150 ${preview.pending ? "opacity-50" : ""}`}
          />
        )}
      </div>
      <p role="status" className="text-xs text-pretty text-muted">
        {blocked ? t.lowContrast : preview.error ? w.previewFailed : (note ?? "")}
      </p>
      <Button variant="secondary" onClick={onReset}>
        <RotateCcw aria-hidden="true" className="size-4" />
        {resetLabel}
      </Button>
    </section>
  );
}
