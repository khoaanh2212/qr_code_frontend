"use client";

import { AtSign, Contact, Link, Mail, MessageSquare, Phone, QrCode, Type, Wifi, type LucideIcon } from "lucide-react";
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
  social: AtSign,
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
      {/* A compact row of pills: phones scroll it sideways (no orphan row), wider screens wrap it.
          `relative` keeps the visually hidden radios inside the scroller, not the page. */}
      <div className="relative -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {types.map(({ type }) => {
          const Icon = lookup<LucideIcon>(ICONS, type) ?? QrCode;
          return (
            <label
              key={type}
              className="inline-flex min-h-11 shrink-0 cursor-pointer snap-start items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium whitespace-nowrap text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground has-checked:border-accent has-checked:bg-accent-soft has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="qr-type"
                value={type}
                checked={value === type}
                onChange={() => onChange(type)}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
              <span>{lookup<string>(t.types, type) ?? type}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
