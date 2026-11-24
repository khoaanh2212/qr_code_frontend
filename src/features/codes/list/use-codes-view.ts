"use client";

import { useCallback, useSyncExternalStore } from "react";

export type CodesView = "list" | "grid";

const KEY = "proofqr.codes.view";
const listeners = new Set<() => void>();
/** Set once storage refuses a write (quota, private mode); wins over the stored value from then on. */
let memory: CodesView | null = null;

function read(): CodesView {
  if (memory) return memory;
  try {
    return localStorage.getItem(KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The list's layout, remembered in this browser. The server renders the default ("list"). */
export function useCodesView(): [CodesView, (view: CodesView) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "list" as const);
  const setView = useCallback((next: CodesView) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage refused: the choice lasts until the page is left.
      memory = next;
    }
    listeners.forEach((l) => l());
  }, []);
  return [view, setView];
}
