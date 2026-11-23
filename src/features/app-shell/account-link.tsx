"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localizePath, splitLocale, type Locale } from "@/i18n/config";

/** Header link to the account pages; current while inside them; icon-only on phones. */
export function AccountLink({ label, locale }: { label: string; locale: Locale }) {
  const rest = splitLocale(usePathname()).rest;
  const current = rest === "/app/account" || rest.startsWith("/app/account/");
  return (
    <Link
      href={localizePath(locale, "/app/account")}
      aria-current={current ? "page" : undefined}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md px-2 text-sm hover:bg-foreground/5 aria-[current=page]:font-semibold"
    >
      <UserRound aria-hidden="true" className="size-4" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Link>
  );
}
