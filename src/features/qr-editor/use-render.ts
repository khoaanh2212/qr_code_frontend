"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, publicApi, sessionApi } from "@/lib/api";
import { SIGNED_IN_RENDER, type RenderRequest } from "@/lib/qr/render-request";

/**
 * Renders through the API: GET (cacheable) or POST, as `request` says. A custom frame caption
 * goes to the signed-in render, with the session cookie; everything else stays session-free.
 */
export function render(request: RenderRequest, signal?: AbortSignal): Promise<Blob> {
  if (request.method === "GET") return publicApi.requestBlob(request.path, { signal });
  const api = request.path === SIGNED_IN_RENDER ? sessionApi : publicApi;
  return api.requestBlob(request.path, { method: "POST", body: request.body, signal });
}

export interface PreviewState {
  /** blob: URL of the latest rendered image, kept while a newer one is on its way. */
  src: string | null;
  /** A newer image is on its way (or waiting for the user to stop typing). */
  pending: boolean;
  /** Error of the latest request, if it failed. */
  error: ApiError | null;
}

interface Result {
  key: string;
  scope: string;
  blob: Blob | null;
  error: ApiError | null;
}

/**
 * Live preview: renders `request` once the user stops changing it for `delayMs`, and cancels
 * outdated requests. `key` identifies the request cheaply (the caller builds it without the
 * logo bytes); `null` means there is nothing to render yet. Within one `scope` the last image
 * stays on screen (dimmed) while the next one loads; switching scope never shows the old one.
 *
 * The image is kept as a Blob in state and its object URL lives in an effect, so the URL is
 * revoked whenever the component hides (React <Activity>, used by Next.js for back/forward)
 * and recreated when it shows again.
 */
export function useRenderPreview(
  request: RenderRequest | null,
  key: string | null,
  /** Results of another scope (another QR type) are never shown. */
  scope = "",
  delayMs = 400,
): PreviewState {
  const [result, setResult] = useState<Result | null>(null);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    if (key === null) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      const current = requestRef.current;
      if (!current) return;
      render(current, abort.signal)
        .then((blob) => {
          if (!abort.signal.aborted) setResult({ key, scope, blob, error: null });
        })
        .catch((err: unknown) => {
          if (abort.signal.aborted) return;
          const error = err instanceof ApiError ? err : new ApiError(0, "network_error", String(err));
          setResult((prev) => ({ key, scope, blob: prev?.scope === scope ? prev.blob : null, error }));
        });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, scope, delayMs]);

  const src = useObjectUrl(result?.scope === scope ? result.blob : null);

  if (key === null) return { src: null, pending: false, error: null };
  const settled = result?.key === key;
  return { src, pending: !settled, error: settled ? result.error : null };
}

/** An object URL for `blob`, revoked when the blob changes or the component hides. */
export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<{ blob: Blob; href: string } | null>(null);
  useEffect(() => {
    if (!blob) return;
    const href = URL.createObjectURL(blob);
    // The URL can only be created in an effect: it must be revoked in the matching cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl({ blob, href });
    return () => {
      URL.revokeObjectURL(href);
      setUrl((current) => (current?.href === href ? null : current));
    };
  }, [blob]);
  return url && url.blob === blob ? url.href : null;
}
