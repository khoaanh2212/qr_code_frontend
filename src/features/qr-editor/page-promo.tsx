"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useId } from "react";
import { sampleUrl } from "@/features/pages/sample";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { saveHandoff } from "@/features/codes/handoff";

/**
 * A hosted page type in the public generator (backend PLAN item 27d): what it is, its sample in a
 * phone frame (the API's fixed sample, sandboxed), and the way to make one, which needs a free
 * account. The type travels to "New code" like a dynamic code's destination (sessionStorage).
 */
export function PagePromo({
  t,
  type,
  name,
  help,
  locale,
}: {
  t: Messages["generator"];
  type: string;
  name: string;
  help: string;
  locale: Locale;
}) {
  const p = t.pagePromo;
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-8 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-8"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <h2 id={headingId} className="text-lg font-semibold">
          {name}
        </h2>
        <p className="max-w-prose text-sm text-pretty text-muted">{help}</p>
        <p className="max-w-prose text-pretty">{p.intro}</p>
        <ul className="flex flex-col gap-2 text-sm">
          {[p.benefitEdit, p.benefitScans, p.benefitNoApp].map((b) => (
            <li key={b} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
              {b}
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-start gap-1.5 pt-2">
          <Link
            href={localizePath(locale, "/app/codes/new")}
            onClick={() => saveHandoff({ url: "", opens: type })}
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
          >
            {p.create}
          </Link>
          <p className="text-xs text-muted">{p.note}</p>
        </div>
      </div>
      <div className="flex justify-center rounded-lg border border-border bg-background p-5">
        <div className="relative aspect-[9/19] w-full max-w-[16rem] overflow-hidden rounded-[2.25rem] border-[10px] border-foreground bg-white shadow-lg">
          <iframe
            key={`${type}-${locale}`}
            title={format(p.sampleFrame, { type: name })}
            src={sampleUrl(type, locale)}
            sandbox=""
            loading="lazy"
            className="size-full border-0"
          />
        </div>
      </div>
    </section>
  );
}
