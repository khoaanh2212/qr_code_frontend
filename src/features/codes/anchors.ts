/** The sections of a code's page that links lead straight to (`/app/codes/{id}#scans`). */
export const CODE_ANCHORS = { destination: "destination", design: "design", scans: "scans" } as const;

export type CodeAnchor = (typeof CODE_ANCHORS)[keyof typeof CODE_ANCHORS];

const KNOWN: ReadonlySet<string> = new Set(Object.values(CODE_ANCHORS));

/** The anchor a URL hash names, or undefined for anything else. */
export function codeAnchorOf(hash: string): CodeAnchor | undefined {
  const name = hash.replace(/^#/, "");
  return KNOWN.has(name) ? (name as CodeAnchor) : undefined;
}
