"use client";

import { Contact, Link, Mail, MessageSquare, Phone, QrCode, Type, Wifi, type LucideIcon } from "lucide-react";
import type { Messages } from "@/i18n/messages";
import type { QrType } from "@/lib/qr/types";
import { lookup } from "./fields";

const ICONS: Record<string, LucideIcon> = {
  url: Link,
  text: Type,
  wifi: Wifi,
  vcard: Contact,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
};

/** QR type as a radio group: arrow keys move between types, as users of radios expect. */
export function TypePicker({
  t,
  types,
  value,
  onChange,
}: {
  t: Messages["generator"];
  types: QrType[];
  value: string;
  onChange: (type: string) => void;
}) {
  return (
    // min-w-0: a fieldset is min-content wide by default, which would stretch the page to the
    // width of the scrolling row on phones.
    <fieldset className="min-w-0">
      <legend className="sr-only">{t.typesLabel}</legend>
      {/* Phones: one scrollable row (no orphan row); wider screens: all seven in a grid.
          `relative` keeps the visually hidden radios inside the scroller, not the page. */}
      <div className="relative -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0 sm:pb-0">
        {types.map(({ type }) => {
          const Icon = lookup<LucideIcon>(ICONS, type) ?? QrCode;
          return (
            <label
              key={type}
              className="flex min-w-[5.25rem] shrink-0 cursor-pointer snap-start flex-col items-center gap-1.5 rounded-lg sm:min-w-0 border border-border bg-surface px-2 py-3 text-center text-sm font-medium text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground has-checked:border-accent has-checked:bg-accent-soft has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="qr-type"
                value={type}
                checked={value === type}
                onChange={() => onChange(type)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
              <span className="leading-tight">{lookup<string>(t.types, type) ?? type}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
