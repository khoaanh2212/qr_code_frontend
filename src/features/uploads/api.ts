import { sessionApi } from "@/lib/api";
import type { Upload } from "@/lib/api/types";

/** Calls of the uploads API (backend PLAN, items 22 and 22b), always with the session. */

const base = (workspaceId: string) => `/v1/workspaces/${encodeURIComponent(workspaceId)}/uploads`;

/** Uploads a file: the API decides what it is from its content and may refuse it. */
export async function uploadFile(workspaceId: string, file: File): Promise<Upload> {
  const form = new FormData();
  form.append("file", file);
  return (await sessionApi.request<{ upload: Upload }>(base(workspaceId), { method: "POST", body: form })).upload;
}

/** One live file of the workspace, with its link on the files host. */
export async function getUpload(workspaceId: string, id: string, signal?: AbortSignal): Promise<Upload> {
  return (await sessionApi.request<{ upload: Upload }>(`${base(workspaceId)}/${encodeURIComponent(id)}`, { signal })).upload;
}

/** Deletes a file the workspace no longer uses. */
export async function deleteUpload(workspaceId: string, id: string): Promise<void> {
  await sessionApi.requestVoid(`${base(workspaceId)}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
