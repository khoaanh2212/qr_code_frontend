import type { CodeStatus, DynamicCode } from "@/lib/api/types";

/**
 * Search, status filter and order of the codes list.
 *
 * The API lists codes newest first and filters nothing yet (backend PLAN, GET /codes takes only a
 * cursor), so the list applies these in the browser over every loaded page. When the API gains
 * `q`, `status` and `sort` parameters, `CodeQuery` maps onto them one to one and these functions
 * stay as the offline fallback.
 */

export type CodeSort = "newest" | "oldest" | "name";
export type StatusFilter = "all" | CodeStatus;

export interface CodeQuery {
  readonly search: string;
  readonly status: StatusFilter;
  readonly sort: CodeSort;
}

export const DEFAULT_QUERY: CodeQuery = { search: "", status: "all", sort: "newest" };

/** Lower case, no diacritics (Vietnamese "đ" included), single spaces. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    // Accents on Latin letters only ("Thực" → "Thuc"); other scripts keep their marks (ガ ≠ カ).
    .replace(/(\p{Script=Latin})\p{M}+/gu, "$1")
    .normalize("NFC")
    .replace(/đ/gi, "d")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** A URL as people paste it: no scheme, no "www.", no trailing slash. */
function bareUrl(text: string): string {
  return text.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/**
 * The words of a search, each normalized and stripped like a URL, so a pasted link matches and a
 * half-typed scheme ("https://") filters nothing.
 */
export function searchWords(search: string): string[] {
  return normalizeSearch(search)
    .split(" ")
    .map((w) => bareUrl(w).replace(/^[a-z][a-z0-9+.-]*:\/*$/, ""))
    .filter(Boolean);
}

/** True when every word of `search` appears in the code's name, short link or destination. */
export function matchesSearch(code: DynamicCode, search: string): boolean {
  const words = searchWords(search);
  if (words.length === 0) return true;
  const haystack = normalizeSearch([code.name, bareUrl(code.short_url), bareUrl(code.target_url)].join(" "));
  return words.every((w) => haystack.includes(w));
}

/** Sort and filter are only correct over the whole list, not over the first page. */
export function needsAllPages(q: CodeQuery): boolean {
  return !isDefaultQuery(q) || q.sort !== "newest";
}

/** No filter narrows the list (the order does not count). */
export function isDefaultQuery(q: CodeQuery): boolean {
  return searchWords(q.search).length === 0 && q.status === "all";
}

const time = (c: DynamicCode) => Date.parse(c.created_at) || 0;

/** The codes `q` selects, in its order. Never mutates `codes`. */
export function applyQuery(codes: readonly DynamicCode[], q: CodeQuery, locale: string): DynamicCode[] {
  const shown = codes.filter((c) => (q.status === "all" || c.status === q.status) && matchesSearch(c, q.search));
  switch (q.sort) {
    case "newest":
      return shown; // the API's own order
    case "oldest":
      return shown.sort((a, b) => time(a) - time(b));
    case "name": {
      const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
      // Untitled codes go last; ties keep the newest first.
      return shown.sort((a, b) => {
        if (!a.name !== !b.name) return a.name ? -1 : 1;
        return collator.compare(a.name, b.name) || time(b) - time(a);
      });
    }
  }
}
