import { SITE_NAME } from "@/lib/site";

/**
 * The ProofQR mark (DESIGN.md "Brand mark"): a QR finder pattern with a Signal Teal centre,
 * framed by four crop marks. Ink follows `currentColor` and the gaps are transparent, so the
 * mark works on paper and on dark grounds alike.
 */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" className={className}>
      {/* Finder pattern: 7 × 7 modules, ring of one module, 3 × 3 centre. */}
      <path fill="currentColor" fillRule="evenodd" d="M10.5 10.5h27v27h-27z M14.36 14.36v19.28h19.28V14.36z" />
      <rect x="18.21" y="18.21" width="11.58" height="11.58" fill="var(--accent)" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
        d="M3 11V3h8 M45 11V3h-8 M3 37v8h8 M45 37v8h-8"
      />
    </svg>
  );
}

/** Mark + name, as used in the headers. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark />
      {SITE_NAME}
    </span>
  );
}
