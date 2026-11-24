import { ChevronDown } from "lucide-react";
import type { Messages } from "@/i18n/messages";
import type { TypePageType } from "@/lib/qr/type-pages";

/**
 * The text of one per-type page below the generator: how-to steps, details specific to the type
 * and its questions. All of it is server-rendered (the generator above it renders in the
 * browser), so this is what search engines read; collapsed answers are still in the HTML.
 */
export function TypeGuide({ t, type }: { t: Messages["typePages"]; type: TypePageType }) {
  const page = t.pages[type];
  const steps = [page.step1, page.step2, page.step3];
  const faq = [
    [page.q1, page.a1],
    [page.q2, page.a2],
    [page.q3, page.a3],
    [page.q4, page.a4],
  ];
  return (
    <div className="grid gap-10 border-t border-border pt-8 lg:grid-cols-2 lg:gap-12">
      <div className="flex flex-col gap-10">
        <section aria-labelledby="how-to-heading" className="flex flex-col gap-4">
          <h2 id="how-to-heading" className="text-lg font-semibold">
            {page.howToTitle}
          </h2>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-sm font-medium tabular-nums"
                >
                  {i + 1}
                </span>
                <p className="max-w-prose pt-0.5 text-pretty">{step}</p>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="details-heading" className="flex flex-col gap-3">
          <h2 id="details-heading" className="text-lg font-semibold">
            {page.detailTitle}
          </h2>
          <p className="max-w-prose text-pretty text-muted">{page.detail1}</p>
          <p className="max-w-prose text-pretty text-muted">{page.detail2}</p>
        </section>
      </div>
      <section aria-labelledby="faq-heading" className="flex flex-col gap-4">
        <h2 id="faq-heading" className="text-lg font-semibold">
          {t.faq}
        </h2>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
          {faq.map(([q, a]) => (
            <details key={q} className="group px-4">
              {/* A flex summary loses the native marker, so the chevron stands in for it. */}
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-prose pb-4 text-pretty text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
