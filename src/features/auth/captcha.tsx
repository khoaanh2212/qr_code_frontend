"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { TURNSTILE_ORIGIN } from "@/lib/security/csp";

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

/** Loads Cloudflare's script once per page, with the page's CSP nonce; a failure can be retried. */
export function loadTurnstile(nonce: string | null): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
    script.async = true;
    if (nonce) script.nonce = nonce;
    const fail = () => {
      script.remove();
      loading = null;
      reject(new Error("turnstile failed to load"));
    };
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : fail());
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}

export interface CaptchaConfig {
  siteKey: string | null;
  nonce: string | null;
  /** Development without a site key: the token to send instead (set by the server, never in production). */
  devToken: string | null;
}

export interface CaptchaLabels {
  label: string;
  loadFailed: string;
  retry: string;
}

/**
 * Cloudflare Turnstile. Calls `onToken` with a fresh token, or null when it expires or fails.
 * Tokens are single use: bump `resetSignal` after every submission to get a new one.
 */
export function Captcha({
  config,
  locale,
  labels,
  onToken,
  resetSignal,
}: {
  config: CaptchaConfig;
  locale: Locale;
  labels: CaptchaLabels;
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const groupId = useId();
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const callback = useRef(onToken);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    callback.current = onToken;
  });

  useEffect(() => {
    if (!config.siteKey) {
      callback.current(config.devToken);
      return;
    }
    let cancelled = false;
    loadTurnstile(config.nonce)
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widget.current = turnstile.render(container.current, {
          sitekey: config.siteKey,
          language: locale,
          theme: "auto",
          size: "flexible",
          callback: (token: string) => {
            setFailed(false);
            callback.current(token);
          },
          "expired-callback": () => callback.current(null),
          "error-callback": () => {
            setFailed(true);
            callback.current(null);
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        callback.current(null);
      });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [config.siteKey, config.nonce, config.devToken, locale, attempt]);

  useEffect(() => {
    if (resetSignal === 0) return;
    if (!config.siteKey) {
      callback.current(config.devToken);
      return;
    }
    callback.current(null);
    if (widget.current) window.turnstile?.reset(widget.current);
  }, [resetSignal, config.siteKey, config.devToken]);

  if (!config.siteKey) return null;
  return (
    <div role="group" aria-labelledby={groupId} className="flex flex-col gap-2">
      <span id={groupId} className="sr-only">
        {labels.label}
      </span>
      <div ref={container} className="min-h-[65px]" />
      {failed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm font-medium text-danger">
          <span>{labels.loadFailed}</span>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-control bg-surface px-3 text-foreground hover:bg-foreground/5"
          >
            <RotateCw aria-hidden="true" className="size-4" />
            {labels.retry}
          </button>
        </div>
      )}
    </div>
  );
}
