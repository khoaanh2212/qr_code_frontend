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
    <fieldset>
      <legend className="sr-only">{t.typesLabel}</legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {types.map(({ type }) => {
          const Icon = lookup<LucideIcon>(ICONS, type) ?? QrCode;
          return (
            <label
              key={type}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-3 text-center text-sm font-medium text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground has-checked:border-accent has-checked:bg-accent-soft has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
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
