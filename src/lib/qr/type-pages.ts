/**
 * Public per-type landing pages ("/wifi-qr-code"): one page per QR type, each opening the
 * generator on its type. Slugs are English in every locale ("/vi/wifi-qr-code") and never
 * change once published: a renamed slug needs a permanent redirect.
 */
export const TYPE_PAGES = [
  { slug: "url-qr-code", type: "url" },
  { slug: "text-qr-code", type: "text" },
  { slug: "wifi-qr-code", type: "wifi" },
  { slug: "vcard-qr-code", type: "vcard" },
  { slug: "email-qr-code", type: "email" },
  { slug: "sms-qr-code", type: "sms" },
  { slug: "phone-qr-code", type: "phone" },
] as const;

export type TypePage = (typeof TYPE_PAGES)[number];
export type TypePageType = TypePage["type"];

/** The page of `slug`, or undefined for anything that is not a published slug. */
export function typePageForSlug(slug: string): TypePage | undefined {
  return TYPE_PAGES.find((p) => p.slug === slug);
}

/** The unprefixed site path of a type's page; localize it with `localizePath`. */
export function typePagePath(type: TypePageType): string {
  const page = TYPE_PAGES.find((p) => p.type === type);
  return `/${page?.slug}`;
}
