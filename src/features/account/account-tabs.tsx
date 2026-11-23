"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localizePath, splitLocale, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

const TABS = [
  { key: "profile", path: "/app/account" },
  { key: "security", path: "/app/account/security" },
  { key: "devices", path: "/app/account/devices" },
] as const;

/** The account's sub-pages as a row of links; the current one carries aria-current. */
export function AccountTabs({ t, locale }: { t: Messages["account"]; locale: Locale }) {
  const current = splitLocale(usePathname()).rest.replace(/\/$/, "");
  return (
    // py-1: the scroller would clip the top and bottom of a link's focus ring.
    <nav aria-label={t.title} className="-mx-4 overflow-x-auto px-4 py-1">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = current === tab.path;
          return (
            <li key={tab.key}>
              <Link
                href={localizePath(locale, tab.path)}
                aria-current={active ? "page" : undefined}
                className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted hover:text-foreground focus-visible:-outline-offset-2 aria-[current=page]:border-accent aria-[current=page]:text-foreground"
              >
                {t.tabs[tab.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
