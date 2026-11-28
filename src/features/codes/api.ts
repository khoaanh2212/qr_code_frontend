import { sessionApi } from "@/lib/api";
import type {
  BulkAction,
  BulkResponse,
  BulkResult,
  Campaign,
  CodeDesign,
  CodeEnvelope,
  CodesPage,
  CodeSort,
  CodeStats,
  StatsBucket,
  StatsDataset,
  CodeStatus,
  DynamicCode,
} from "@/lib/api/types";
import type { QrFormat } from "@/lib/qr/types";
import type { PageBody, PageToSend } from "@/features/pages/content";
import type { DestinationBody, SocialBody } from "./destination";

/** Calls of the dynamic codes API (backend PLAN, items 35-37), always with the session. */

const base = (workspaceId: string) => `/v1/workspaces/${encodeURIComponent(workspaceId)}/codes`;
const one = (workspaceId: string, id: string) => `${base(workspaceId)}/${encodeURIComponent(id)}`;

/** Search, status and folder filters and order of the list; omitted means "any" / newest first. */
export interface CodeListParams {
  q?: string;
  status?: CodeStatus;
  /** A folder id, or "none" for the codes in no folder. */
  folder?: string;
  sort?: Exclude<CodeSort, "newest">;
}

/** A page of the list; `cursor` must come from the previous page of the same params. */
export async function listCodes(workspaceId: string, params: CodeListParams = {}, cursor?: string, signal?: AbortSignal): Promise<CodesPage> {
  const q = new URLSearchParams({ limit: "50" });
  if (params.q) q.set("q", params.q);
  if (params.status) q.set("status", params.status);
  if (params.folder) q.set("folder", params.folder);
  if (params.sort) q.set("sort", params.sort);
  if (cursor) q.set("cursor", cursor);
  return sessionApi.request<CodesPage>(`${base(workspaceId)}?${q}`, { signal });
}

/** The most codes one bulk request takes (the API refuses more). */
export const BULK_MAX_CODES = 100;

/** Pauses, resumes or deletes up to BULK_MAX_CODES codes; a result per id, in order. */
export async function bulkCodes(workspaceId: string, action: Exclude<BulkAction, "move">, ids: readonly string[]): Promise<BulkResult[]> {
  return (await sessionApi.request<BulkResponse>(`${base(workspaceId)}/bulk`, { method: "POST", body: { action, ids } })).results;
}

/** Moves up to BULK_MAX_CODES codes into a folder, or out of any folder (null); a result per id. */
export async function bulkMove(workspaceId: string, ids: readonly string[], folderId: string | null): Promise<BulkResult[]> {
  const body = { action: "move", ids, folder_id: folderId };
  return (await sessionApi.request<BulkResponse>(`${base(workspaceId)}/bulk`, { method: "POST", body })).results;
}

export async function getCode(workspaceId: string, id: string, signal?: AbortSignal): Promise<DynamicCode> {
  return (await sessionApi.request<CodeEnvelope>(one(workspaceId, id), { signal })).code;
}

/** A new code leads to `target_url`, or to the link the API builds from `social` (never both). */
export type NewCode = {
  name: string;
  design: CodeDesign;
  captcha_token: string;
} & (DestinationBody | { page: PageBody });

export async function createCode(workspaceId: string, body: NewCode): Promise<DynamicCode> {
  return (await sessionApi.request<CodeEnvelope>(base(workspaceId), { method: "POST", body })).code;
}

export interface CodeChanges {
  name?: string;
  target_url?: string;
  /** A social profile preset instead of `target_url`; the API stores the link it builds. */
  social?: SocialBody;
  /** The last part of the short link; the old link keeps working. */
  short_code?: string;
  /** Replaces the whole design. */
  design?: CodeDesign;
  status?: Exclude<CodeStatus, "locked">;
  /** A folder id to move the code into, or null to take it out of its folder. */
  folder_id?: string | null;
  /** Replaces all campaign details (a null field is cleared); null clears them all. */
  campaign?: Campaign | null;
  /** Replaces a page code's page (the type stays). */
  page?: PageToSend;
}

export async function updateCode(workspaceId: string, id: string, body: CodeChanges): Promise<DynamicCode> {
  return (await sessionApi.request<CodeEnvelope>(one(workspaceId, id), { method: "PATCH", body })).code;
}

export async function deleteCode(workspaceId: string, id: string): Promise<void> {
  await sessionApi.requestVoid(one(workspaceId, id), { method: "DELETE" });
}

/** The code's image (it encodes the short link), as a blob for an object URL or a download. */
export async function codeImage(workspaceId: string, id: string, format: QrFormat, size = 1024): Promise<Blob> {
  const q = new URLSearchParams({ format, size: String(size) });
  return sessionApi.requestBlob(`${one(workspaceId, id)}/image?${q}`);
}

/** What one statistics download holds: a period, the grouping of its series and the table. */
export interface StatsExport {
  from: string;
  to: string;
  bucket: StatsBucket;
  dataset: StatsDataset;
}

/**
 * One table of a code's statistics as a CSV file (backend PLAN, item 56). The API escapes cells a
 * spreadsheet would run and limits downloads per account (429 `rate_limited`).
 */
export async function exportCodeStats(workspaceId: string, id: string, what: StatsExport): Promise<Blob> {
  const q = new URLSearchParams({ from: what.from, to: what.to, bucket: what.bucket, dataset: what.dataset });
  return sessionApi.requestBlob(`${one(workspaceId, id)}/stats/export?${q}`, {}, "text/csv");
}

/** A code's scans over a period of UTC days, both ends included (at most 366 days). */
export async function codeStats(workspaceId: string, id: string, range: { from: string; to: string }, signal?: AbortSignal): Promise<CodeStats> {
  const q = new URLSearchParams(range);
  return sessionApi.request<CodeStats>(`${one(workspaceId, id)}/stats?${q}`, { signal });
}
