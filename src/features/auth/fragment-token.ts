"use client";

import { useEffect, useRef, useState } from "react";

export type FragmentToken = { kind: "reading" } | { kind: "missing" } | { kind: "present"; token: string };

const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * Reads `#token=…` from the address once, then removes the fragment from the address bar and
 * history, so the single-use secret does not linger on screen, in screenshots or in history.
 * Tokens travel in the fragment because servers and Referer headers never see it.
 */
export function useFragmentToken(): FragmentToken {
  const [state, setState] = useState<FragmentToken>({ kind: "reading" });
  const read = useRef(false);

  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    if (window.location.hash) {
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
    const next: FragmentToken = TOKEN.test(token) ? { kind: "present", token } : { kind: "missing" };
    // The address is only readable after hydration; one extra render is the price.
    setState(next);
  }, []);

  return state;
}
