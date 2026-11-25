"use client";

import { useEffect, useState } from "react";
import { redirectToLogin, usePersonalWorkspace } from "@/features/auth/require-session";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { getCode } from "./api";

export type CodeLoad = { kind: "loading" } | { kind: "ready"; code: DynamicCode } | { kind: "missing" } | { kind: "error" };

/**
 * One code of the personal workspace, for the pages of a code (insights, content, design).
 * `setCode` takes what an edit returned, so the page shows it without loading again.
 */
export function useCode(id: string): { load: CodeLoad; setCode: (code: DynamicCode) => void; workspaceId?: string; canEdit: boolean } {
  const workspace = usePersonalWorkspace();
  const ws = workspace?.id;
  const [load, setLoad] = useState<CodeLoad>({ kind: "loading" });

  useEffect(() => {
    if (!ws) return;
    const abort = new AbortController();
    getCode(ws, id, abort.signal)
      .then((code) => {
        if (abort.signal.aborted) return; // an answer for a code this page has left
        setLoad(code ? { kind: "ready", code } : { kind: "missing" });
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) return redirectToLogin();
        setLoad({ kind: err instanceof ApiError && err.status === 404 ? "missing" : "error" });
      });
    return () => abort.abort();
  }, [ws, id]);

  return {
    load: ws ? load : { kind: "error" },
    setCode: (code) => setLoad({ kind: "ready", code }),
    workspaceId: ws,
    canEdit: workspace?.role !== undefined && workspace.role !== "viewer",
  };
}
