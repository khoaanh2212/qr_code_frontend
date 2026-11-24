"use client";

import { QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DynamicCode } from "@/lib/api/types";
import { codeImage } from "../api";

/**
 * Images already fetched in this page, by code and design: scrolling back, switching layout or
 * filtering does not fetch them again. Bounded (oldest dropped first); failures are not kept.
 */
const cache = new Map<string, Promise<Blob>>();
const CACHE_SIZE = 300;

function thumbnail(workspaceId: string, id: string, key: string): Promise<Blob> {
  let hit = cache.get(key);
  if (!hit) {
    hit = codeImage(workspaceId, id, "png", 256);
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

/** Test hook: forget every cached image. */
export function clearThumbnailCache(): void {
  cache.clear();
}

/**
 * The code's printable image, small. Fetched with the session only once the card nears the
 * viewport (a long list does not fire a request per code up front) and again when the code's
 * design changes (not on pause or rename); the object URL is revoked when it is replaced or the card unmounts.
 * DESIGN.md: always on white with a 2px radius; a code that failed to load is never faked, an
 * outline icon takes its place.
 */
export function CodeThumbnail({ workspaceId, code, className = "" }: { workspaceId: string; code: DynamicCode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const [image, setImage] = useState<{ key: string; src: string | null; failed: boolean }>();
  // Pausing or renaming does not change the image; only the design does.
  const key = `${code.id}:${JSON.stringify(code.design)}`;

  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let live = true;
    let url: string | null = null;
    thumbnail(workspaceId, code.id, `${workspaceId}:${key}`)
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setImage({ key, src: url, failed: false });
      })
      .catch(() => live && setImage({ key, src: null, failed: true }));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [near, workspaceId, code.id, key]);

  const current = image?.key === key ? image : undefined;
  return (
    <div ref={box} className={`flex aspect-square items-center justify-center overflow-hidden rounded-[2px] border border-border bg-white p-1 ${className}`}>
      {current?.src ? (
        // A blob: URL from the API; next/image cannot optimize it. The card names the code.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current.src} alt="" className="size-full object-contain" />
      ) : current?.failed ? (
        <QrCode aria-hidden="true" className="size-1/2 text-stone-300" strokeWidth={1.25} />
      ) : (
        <Skeleton className="size-full bg-stone-200/60" />
      )}
    </div>
  );
}
