import type { DynamicCode } from "@/lib/api/types";

/** These limits mirror the backend (internal/model/qrcode.go); the server stays the authority. */
export const SLUG_MIN = 4;
export const SLUG_MAX = 40;
/** How many times one code's short link may be changed. */
export const MAX_SLUG_CHANGES = 3;
/** How many custom short links a workspace may take over its lifetime. */
export const MAX_CUSTOM_SLUGS = 50;

/** Values for the `{min}`, `{max}`, `{changes}` and `{slugs}` placeholders of the messages. */
export const SLUG_LIMITS = { min: SLUG_MIN, max: SLUG_MAX, changes: MAX_SLUG_CHANGES, slugs: MAX_CUSTOM_SLUGS } as const;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The shape rules of a custom short link (not the deceptive-word list: the server decides that). */
export function validSlug(slug: string): boolean {
  return slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_SHAPE.test(slug);
}

/** The fixed part of the short link: the current link without its code. */
export function slugOrigin(code: Pick<DynamicCode, "short_url" | "short_code">): string {
  const { short_url: url, short_code: slug } = code;
  return url.endsWith(slug) ? url.slice(0, url.length - slug.length) : url.slice(0, url.lastIndexOf("/") + 1);
}
