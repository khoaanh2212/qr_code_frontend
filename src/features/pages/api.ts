import { publicApi, sessionApi } from "@/lib/api";
import type { PageBody, PageTypeInfo } from "./content";

/** Calls of the hosted pages API (backend PLAN items 23 and 27). */

/** The page types and their content fields (public). */
export async function getPageTypes(signal?: AbortSignal): Promise<PageTypeInfo[]> {
  const res = await publicApi.request<{ types: PageTypeInfo[] }>("/v1/page-types", { signal });
  return res.types;
}

/** A page being edited, drawn by the API as it will look (HTML, framed sandboxed by the editor). */
export async function previewPage(workspaceId: string, page: PageBody, signal?: AbortSignal): Promise<string> {
  const blob = await sessionApi.requestBlob(
    `/v1/workspaces/${encodeURIComponent(workspaceId)}/pages/preview`,
    { method: "POST", body: { page }, signal },
    "text/html",
  );
  return blob.text();
}

export { sampleUrl } from "./sample";
