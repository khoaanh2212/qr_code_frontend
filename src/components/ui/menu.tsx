"use client";

import { ChevronDown, MoreVertical, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * An actions menu: a button that opens a list of commands (WAI-ARIA "menu button").
 *
 * - Click, Enter, Space or ArrowDown open it on the first item; ArrowUp opens it on the last.
 * - Arrow keys, Home and End move between items (disabled ones included, announced as such); Escape closes and returns focus to the
 *   button; Tab or a click outside closes it.
 * - Choosing an item closes the menu, gives focus back to the button, then runs the action, so a
 *   dialog the action opens returns focus to the button when it closes.
 */

interface MenuContextValue {
  close: (refocus: boolean) => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

// Disabled items stay reachable (WAI-ARIA menu pattern): announced as unavailable, not hidden.
const ITEMS = '[role="menuitem"]';

export interface MenuProps {
  /** Accessible name of the button ("Actions for Menu"). Also its tooltip. */
  label: string;
  icon?: LucideIcon;
  /** Which edge of the button the list lines up with. */
  align?: "start" | "end";
  /** `labelled` shows the label next to the icon, as a secondary button (a menu of downloads). */
  variant?: "icon" | "labelled";
  children: ReactNode;
}

const TRIGGER = {
  icon: "size-11 justify-center text-muted hover:text-foreground aria-expanded:text-foreground",
  // The secondary button of DESIGN.md: Control Edge outline, 44px tall.
  labelled: "min-h-11 gap-2 border border-control bg-surface px-3 text-sm font-medium",
} as const;

export function Menu({ label, icon: Icon = MoreVertical, align = "end", variant = "icon", children }: MenuProps) {
  const [open, setOpen] = useState<false | "first" | "last">(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const items = () => Array.from(list.current?.querySelectorAll<HTMLElement>(ITEMS) ?? []);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  }, []);

  // Focus the requested item once the list exists.
  useEffect(() => {
    if (!open) return;
    const all = items();
    (open === "first" ? all[0] : all.at(-1))?.focus();
  }, [open]);

  // A press anywhere outside closes the menu without stealing the new focus target.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  function onButtonKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(e.key === "ArrowDown" ? "first" : "last");
    }
  }

  function onListKey(e: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => all[(i + all.length) % all.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        go(at + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        go(at - 1);
        break;
      case "Home":
        e.preventDefault();
        go(0);
        break;
      case "End":
        e.preventDefault();
        go(all.length - 1);
        break;
      case "Escape":
        e.preventDefault();
        close(true);
        break;
      case "Tab":
        // Let Tab continue from the button: the focused item is about to unmount.
        button.current?.focus();
        close(false);
        break;
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={variant === "icon" ? label : undefined}
        title={variant === "icon" ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open !== false}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen("first"))}
        onKeyDown={onButtonKey}
        className={`inline-flex items-center rounded-md transition-colors duration-150 hover:bg-foreground/5 aria-expanded:bg-foreground/5 ${TRIGGER[variant]}`}
      >
        <Icon aria-hidden="true" className={variant === "icon" ? "size-5" : "size-4"} strokeWidth={1.75} />
        {variant === "labelled" && (
          <>
            {label}
            <ChevronDown aria-hidden="true" className="size-4 text-muted" strokeWidth={1.75} />
          </>
        )}
      </button>
      {open && (
        <MenuContext value={{ close }}>
          <div
            ref={list}
            id={id}
            role="menu"
            aria-label={label}
            onKeyDown={onListKey}
            // DESIGN.md Float: the one shadow a menu earns.
            className={`absolute top-full z-30 mt-1 flex min-w-52 flex-col rounded-lg border border-border bg-surface py-1 shadow-[0_8px_24px_rgb(0_0_0/0.12)] ${align === "end" ? "right-0" : "left-0"}`}
          >
            {children}
          </div>
        </MenuContext>
      )}
    </div>
  );
}

export interface MenuItemProps {
  onSelect: () => void;
  icon?: LucideIcon;
  /** `danger` for irreversible commands (delete); keep them last, after a separator. */
  tone?: "default" | "danger";
  /** Stays in the list, announced as unavailable, so the menu's shape does not change. */
  disabled?: boolean;
  children: ReactNode;
}

export function MenuItem({ onSelect, icon: Icon, tone = "default", disabled = false, children }: MenuItemProps) {
  const menu = useContext(MenuContext);
  if (!menu) throw new Error("MenuItem must be used inside a Menu");
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        menu.close(true);
        onSelect();
      }}
      className={`flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-medium outline-none hover:bg-foreground/5 focus-visible:bg-foreground/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${tone === "danger" ? "text-danger" : "text-foreground"}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />}
      {children}
    </button>
  );
}

/** A rule between groups of items. */
export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-border" />;
}
