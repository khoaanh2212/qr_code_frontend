"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words. Linked as the dialog's description. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` for irreversible actions: the confirm button is Stop Red. */
  tone?: "danger" | "primary";
  /** The confirmed action runs: buttons stay focusable but inert, Escape does nothing. */
  busy?: boolean;
  /** Why the action failed; the dialog stays open so the person can retry or cancel. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation on the native `<dialog>`: the browser traps focus, makes the page inert and
 * maps Escape to "cancel"; closing returns focus to the control that opened it. Reserved for
 * irreversible actions (delete), where protected focus is the point. Cancel has focus first.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancel.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // Re-run when the content changes too, so a dialog closed by the browser opens again.
  }, [open, title, error]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        // Escape: the browser would close the dialog itself; let React state decide.
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={() => {
        // The browser closed it on its own (a repeated Escape): bring the state in line.
        if (open) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_8px_24px_rgb(0_0_0/0.12)] backdrop:bg-black/40"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-lg font-semibold text-balance">
            {title}
          </h2>
          <div id={bodyId} className="text-sm text-pretty text-muted">
            {children}
          </div>
          <p role="alert" className="text-sm font-medium text-danger empty:hidden">
            {error ?? ""}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button ref={cancel} variant="secondary" onClick={() => !busy && onCancel()} aria-disabled={busy || undefined}>
              {cancelLabel}
            </Button>
            <Button variant={tone} busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
