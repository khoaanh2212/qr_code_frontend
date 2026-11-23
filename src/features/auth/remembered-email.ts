"use client";

import { useSyncExternalStore } from "react";

/**
 * The email typed on one auth page, offered on the next (login → forgot password → back), so
 * nobody retypes it. Kept in sessionStorage for this tab only, never in a URL.
 */
const KEY = "auth:email";

export function rememberEmail(value: string): void {
  try {
    sessionStorage.setItem(KEY, value.trim());
  } catch {
    // Storage blocked (private mode, policy): the next page just starts empty.
  }
}

const noSubscribe = () => () => {};
function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The remembered email ("" on the server and when there is none). */
export function useRememberedEmail(): string {
  return useSyncExternalStore(noSubscribe, read, () => "");
}
