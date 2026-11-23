"use client";

import { useEffect, useState } from "react";
import { ApiError, publicApi } from "@/lib/api";
import type { QrCatalog } from "@/lib/qr/types";

const NAME = /^[a-z][a-z0-9_]{0,31}$/;

/**
 * Keeps only well-formed type and field names: they become element ids, download file names
 * and translation keys.
 */
export function sanitizeCatalog(catalog: QrCatalog): QrCatalog {
  return {
    ...catalog,
    types: catalog.types
      .filter((t) => NAME.test(t.type))
      .map((t) => ({ ...t, fields: t.fields.filter((f) => NAME.test(f.name)) })),
  };
}

export type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; catalog: QrCatalog }
  | { kind: "error"; error: ApiError };

/** Loads `GET /v1/qr/types`; `reload` retries after an error. */
export function useQrTypes(): { state: CatalogState; reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; state: CatalogState } | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    publicApi
      .request<QrCatalog>("/v1/qr/types", { signal: abort.signal })
      .then((catalog) => setResult({ attempt, state: { kind: "ready", catalog: sanitizeCatalog(catalog) } }))
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        const error = err instanceof ApiError ? err : new ApiError(0, "network_error", String(err));
        setResult({ attempt, state: { kind: "error", error } });
      });
    return () => abort.abort();
  }, [attempt]);

  // A result belongs to one attempt: after "reload" the state is loading again until it settles.
  const state: CatalogState = result && result.attempt === attempt ? result.state : { kind: "loading" };
  return { state, reload: () => setAttempt((n) => n + 1) };
}
