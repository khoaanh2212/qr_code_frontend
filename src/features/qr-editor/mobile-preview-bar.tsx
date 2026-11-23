"use client";

import { QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import type { Messages } from "@/i18n/messages";

/**
 * Phones only: while the preview is off screen, a bar at the bottom shows the current code and
 * jumps to the preview and its download button.
 */
export function MobilePreviewBar({
  t,
  src,
  targetId,
}: {
  t: Messages["generator"];
  src: string | null;
  targetId: string;
}) {
  const [previewVisible, setPreviewVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPreviewVisible(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (previewVisible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.08)] backdrop-blur-sm lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-white">
          {src ? (
            // A blob: URL from the API; next/image cannot optimize it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="size-full object-contain" />
          ) : (
            <QrCode aria-hidden="true" className="size-6 text-muted" strokeWidth={1.5} />
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const target = document.getElementById(targetId);
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
            // Land on the download button, so keyboard and screen reader users arrive there too.
            target?.querySelector<HTMLButtonElement>("[data-qr-download]")?.focus({ preventScroll: true });
          }}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-accent px-4 font-semibold text-accent-foreground"
        >
          {t.preview.jump}
        </button>
      </div>
    </div>
  );
}
