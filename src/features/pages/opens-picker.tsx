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
  Star,
  Ticket,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";

const ICONS: Record<string, LucideIcon> = {
  url: Globe,
  social: AtSign,
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

export interface OpensOption {
  value: string;
  label: string;
  help: string;
}

/**
 * What a new code opens, as a grid of cards (radios): a website or a social profile, then the
 * pages ProofQR hosts. Arrow keys move between them, as with any radio group; a card's short
 * description is read after its name.
 */
export function OpensPicker({
  legend,
  pageGroup,
  links,
  pages,
  value,
  onChange,
}: {
  legend: string;
  /** The heading of the hosted pages' cards. */
  pageGroup: string;
  links: OpensOption[];
  pages: OpensOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const ids = { legend: useId(), pages: useId(), name: useId() };
  const card = (o: OpensOption) => {
    const Icon = ICONS[o.value] ?? Globe;
    const helpId = `${ids.name}-${o.value}-help`;
    return (
      <label
        key={o.value}
        className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3 text-sm transition-colors duration-150 hover:border-foreground/40 has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
      >
        <input
          type="radio"
          name={ids.name}
          value={o.value}
          checked={value === o.value}
          onChange={() => onChange(o.value)}
          aria-describedby={helpId}
          className="sr-only"
        />
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.75} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">{o.label}</span>
          <span id={helpId} aria-hidden="true" className="text-xs text-pretty text-muted">
            {o.help}
          </span>
        </span>
      </label>
    );
  };
  return (
    <div role="radiogroup" aria-labelledby={ids.legend} className="flex flex-col gap-3">
      <h2 id={ids.legend} className="text-lg font-semibold">
        {legend}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">{links.map(card)}</div>
      {pages.length > 0 && (
        <>
          <p id={ids.pages} className="mt-2 text-sm font-semibold text-muted">
            {pageGroup}
          </p>
          <div role="group" aria-labelledby={ids.pages} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map(card)}
          </div>
        </>
      )}
    </div>
  );
}
