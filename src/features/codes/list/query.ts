import type { CodeSort, CodeStatus } from "@/lib/api/types";
import type { CodeListParams } from "../api";

/**
 * Search, status filter and order of the codes list, as the toolbar holds them. The API applies
 * them (backend PLAN item 50): search ignores case and accents and matches the name, the short
 * code and the destination; `listParams` turns the toolbar state into query parameters.
 */

export type { CodeSort };
export type StatusFilter = "all" | CodeStatus;

export interface CodeQuery {
  readonly search: string;
  readonly status: StatusFilter;
  readonly sort: CodeSort;
}

export const DEFAULT_QUERY: CodeQuery = { search: "", status: "all", sort: "newest" };

/** What the API takes for `q` (backend PLAN item 50); more is refused with 422. */
export const MAX_SEARCH_CHARS = 100;
export const MAX_SEARCH_WORDS = 10;

/**
 * The search as the API takes it: single spaces, each word once (case-insensitively, as the API
 * compares them), at most MAX_SEARCH_WORDS words and MAX_SEARCH_CHARS characters (code points).
 * Longer input is cut rather than refused, so a pasted sentence still searches.
 */
export function normalizeSearch(text: string): string {
  const words: string[] = [];
  for (const w of text.trim().split(/\s+/)) {
    if (w && !words.some((x) => x.toLowerCase() === w.toLowerCase())) words.push(w);
  }
  return [...words.slice(0, MAX_SEARCH_WORDS).join(" ")].slice(0, MAX_SEARCH_CHARS).join("").trim();
}

/** The API parameters for `q`: only what differs from the default list. */
export function listParams(q: CodeQuery): CodeListParams {
  const out: CodeListParams = {};
  const search = normalizeSearch(q.search);
  if (search) out.q = search;
  if (q.status !== "all") out.status = q.status;
  if (q.sort !== "newest") out.sort = q.sort;
  return out;
}

/** No filter narrows the list (the order does not count). */
export function isDefaultQuery(q: CodeQuery): boolean {
  return q.search.trim() === "" && q.status === "all";
}
