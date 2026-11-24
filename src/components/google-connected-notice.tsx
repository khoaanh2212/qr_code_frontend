"use client";

import { CircleCheck, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
/** The API adds ?google=connected after a Google login that created or linked the account. */
const connectedInUrl = () => new URLSearchParams(window.location.search).get("google") === "connected";

/**
 * "Google is connected", once, after a Google login that created the account or linked Google
 * to it. The marker is removed from the address at once, so a reload or a shared link does not
 * repeat it. Rendered on the client only (the server snapshot is false), so cached pages stay
 * the same for everyone.
 */
export function GoogleConnectedNotice({ message, dismiss }: { message: string; dismiss: string }) {
  const connected = useSyncExternalStore(noSubscribe, connectedInUrl, () => false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!connected) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("google");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    const timer = setTimeout(() => setHidden(true), 10_000);
    return () => clearTimeout(timer);
  }, [connected]);

  if (!connected || hidden) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border border-accent/40 bg-surface px-4 py-3 text-sm shadow-lg"
      >
        <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
        <p className="text-pretty">{message}</p>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label={dismiss}
          className="-m-2 inline-flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-foreground/5"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
