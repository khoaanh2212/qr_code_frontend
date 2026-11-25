"use client";

import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./icon-button";

export interface DrawerProps {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that slides in from the left on the native `<dialog>`: the browser traps focus, makes the
 * page inert and maps Escape to "close"; closing returns focus to the control that opened it. For
 * navigation and filters that have a column of their own on wide screens. A click on the backdrop
 * closes it (a drag out of the panel does not). Its content is only rendered while it is open.
 */
export function Drawer({ open, title, closeLabel, onClose, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Where the press began: a drag that starts in the panel and ends outside is not a click outside.
  const pressedBackdrop = useRef(false);

  // A layout effect: the panel must be closed (focus back on its opener, the page no longer inert)
  // before the effects of whatever it made way for run, such as a form focusing its first field.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape: the browser would close the dialog itself; let React state decide.
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        // The browser closed it on its own (a repeated Escape): bring the state in line.
        if (open) onClose();
      }}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // The dialog element itself is only hit outside its content: the backdrop. The press
        // must have begun there too.
        if (e.target === e.currentTarget && pressedBackdrop.current) onClose();
        pressedBackdrop.current = false;
      }}
      className="drawer m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-3rem))] max-w-none border-r border-border bg-background p-0 text-foreground shadow-[8px_0_24px_rgb(0_0_0/0.12)] backdrop:bg-black/40"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border py-2 pr-2 pl-4">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <IconButton label={closeLabel} icon={X} onClick={onClose} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
