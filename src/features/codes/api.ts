import { sessionApi } from "@/lib/api";
import type {
  BulkAction,
  BulkResponse,
  BulkResult,
  CodeDesign,
  CodeEnvelope,
  CodesPage,
  CodeSort,
  CodeStats,
  CodeStatus,
  DynamicCode,
} from "@/lib/api/types";
import type { QrFormat } from "@/lib/qr/types";

/** Calls of the dynamic codes API (backend PLAN, items 35-37), always with the session. */

const base = (workspaceId: string) => `/v1/workspaces/${encodeURIComponent(workspaceId)}/codes`;
const one = (workspaceId: string, id: string) => `${base(workspaceId)}/${encodeURIComponent(id)}`;

/** Search, status filter and order of the list; omitted means "any" / newest first. */
export interface CodeListParams {
  q?: string;
  status?: CodeStatus;
  sort?: Exclude<CodeSort, "newest">;
}

/** A page of the list; `cursor` must come from the previous page of the same params. */
export async function listCodes(workspaceId: string, params: CodeListParams = {}, cursor?: string, signal?: AbortSignal): Promise<CodesPage> {
  const q = new URLSearchParams({ limit: "50" });
  if (params.q) q.set("q", params.q);
  if (params.status) q.set("status", params.status);
  if (params.sort) q.set("sort", params.sort);
  if (cursor) q.set("cursor", cursor);
  return sessionApi.request<CodesPage>(`${base(workspaceId)}?${q}`, { signal });
}

/** The most codes one bulk request takes (the API refuses more). */
export const BULK_MAX_CODES = 100;

/** Pauses, resumes or deletes up to BULK_MAX_CODES codes; a result per id, in order. */
export async function bulkCodes(workspaceId: string, action: BulkAction, ids: readonly string[]): Promise<BulkResult[]> {
  return (await sessionApi.request<BulkResponse>(`${base(workspaceId)}/bulk`, { method: "POST", body: { action, ids } })).results;
}

export async function getCode(workspaceId: string, id: string, signal?: AbortSignal): Promise<DynamicCode> {
  return (await sessionApi.request<CodeEnvelope>(one(workspaceId, id), { signal })).code;
}

export interface NewCode {
  name: string;
  target_url: string;
  design: CodeDesign;
  captcha_token: string;
}

export async function createCode(workspaceId: string, body: NewCode): Promise<DynamicCode> {
  return (await sessionApi.request<CodeEnvelope>(base(workspaceId), { method: "POST", body })).code;
}

export interface CodeChanges {
  name?: string;
  target_url?: string;
  /** Replaces the whole design. */
  design?: CodeDesign;
  status?: Exclude<CodeStatus, "locked">;
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

export async function codeStats(workspaceId: string, id: string, signal?: AbortSignal): Promise<CodeStats> {
  return sessionApi.request<CodeStats>(`${one(workspaceId, id)}/stats`, { signal });
}
