import { publicApi } from "@/lib/api";

/**
 * The sample page of a type in a language: a URL to frame (public, cacheable, fixed content).
 * Kept apart from the session-using calls so the public generator can import it.
 */
export function sampleUrl(type: string, lang: string): string {
  return publicApi.url(`/v1/page-types/${encodeURIComponent(type)}/sample?lang=${encodeURIComponent(lang)}`);
}
