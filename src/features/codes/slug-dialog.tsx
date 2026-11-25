"use client";

import { useId, useLayoutEffect, useRef } from "react";
import type { AuthMessages } from "@/features/auth/form-rules";
import type { Messages } from "@/i18n/messages";
import type { DynamicCode } from "@/lib/api/types";
import { SlugEditor } from "./slug-editor";

/**
 * "Edit short link" as a modal `<dialog>` around the slug editor, from a code's menus (its
 * insights page, its row in the list). Escape and Cancel close it; the browser returns focus to
 * the control that opened it. `onClose(true)` after a change.
 */
export function SlugDialog({
  t,
  auth,
  ws,
  code,
  onSaved,
  onClose,
}: {
  t: Messages["codes"];
  auth: AuthMessages;
  ws: string;
  code: DynamicCode;
  onSaved: (code: DynamicCode) => void;
  onClose: (saved?: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Opened once it is in the page; not closed on cleanup (see ReadyDialog: StrictMode).
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_8px_24px_rgb(0_0_0/0.12)] backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-lg font-semibold">
          {t.pages.editShortLink}
        </h2>
        <SlugEditor t={t} auth={auth} ws={ws} code={code} onSaved={onSaved} onClose={onClose} />
      </div>
    </dialog>
  );
}
