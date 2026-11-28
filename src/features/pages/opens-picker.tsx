"use client";

import {
  AppWindow,
  AtSign,
  Briefcase,
  CalendarDays,
  Contact,
  FileText,
  Globe,
  Images,
  Link as LinkIcon,
  MessageSquareText,
  Music,
  Share2,
  Star,
  Ticket,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";

/** The links a code can open ("url", "social"). */
const LINK_ICONS: Record<string, LucideIcon> = {
  url: Globe,
  social: AtSign,
};

/** The hosted page types (values "page:<type>"). */
const PAGE_ICONS: Record<string, LucideIcon> = {
  social: Share2,
  links: LinkIcon,
  contact: Contact,
  business: Briefcase,
  pdf: FileText,
  coupon: Ticket,
  app: AppWindow,
  event: CalendarDays,
  images: Images,
  menu: UtensilsCrossed,
  audio: Music,
  video: Video,
  feedback: MessageSquareText,
  rating: Star,
};

/** The icon of what a code opens (a website, a social profile or a hosted page type). */
export function OpensIcon({ value, className }: { value: string; className?: string }) {
  const Icon = (value.startsWith("page:") ? PAGE_ICONS[value.slice(5)] : LINK_ICONS[value]) ?? Globe;
  return <Icon aria-hidden="true" className={className} strokeWidth={1.5} />;
}

export interface OpensOption {
  value: string;
  label: string;
  help: string;
}

/**
 * The other things a new code can open, as a two-column grid of cards (radios) under a divider
 * that names the group: a website or a social profile, then the pages ProofQR hosts. Arrow keys
 * move between them, as with any radio group; a card's short description is read after its name.
 * Pointing at a card (or focusing it) peeks at it: `onPeek` gets its value, then null.
 */
export function OpensPicker({
  legend,
  options,
  value,
  onChange,
  onPeek,
}: {
  legend: string;
  options: OpensOption[];
  value: string;
  onChange: (value: string) => void;
  onPeek?: (value: string | null) => void;
}) {
  const ids = { legend: useId(), name: useId() };
  // The pointer and the keyboard peek separately: the pointer's card wins while it is over one,
  // then the focused card's peek comes back.
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const peek = hover ?? focus;
  useEffect(() => {
    onPeek?.(peek);
  }, [peek, onPeek]);
  return (
    <div role="radiogroup" aria-labelledby={ids.legend} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <h2 id={ids.legend} className="text-sm font-medium text-muted">
          {legend}
        </h2>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const Icon = (o.value.startsWith("page:") ? PAGE_ICONS[o.value.slice(5)] : LINK_ICONS[o.value]) ?? Globe;
          const helpId = `${ids.name}-${o.value}-help`;
          return (
            <label
              key={o.value}
              onMouseEnter={() => setHover(o.value)}
              onMouseLeave={() => setHover((h) => (h === o.value ? null : h))}
              className="flex min-h-11 cursor-pointer items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3.5 transition-colors duration-150 hover:border-control has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name={ids.name}
                value={o.value}
                checked={value === o.value}
                onChange={() => {
                  setHover(null);
                  setFocus(null);
                  onChange(o.value);
                }}
                onFocus={() => setFocus(o.value)}
                onBlur={() => setFocus((f) => (f === o.value ? null : f))}
                aria-describedby={helpId}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="size-6 shrink-0 text-accent" strokeWidth={1.5} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-semibold">{o.label}</span>
                <span id={helpId} aria-hidden="true" className="text-sm text-pretty text-muted">
                  {o.help}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
