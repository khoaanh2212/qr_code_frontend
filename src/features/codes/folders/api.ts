import { sessionApi } from "@/lib/api";
import type { Folder } from "@/lib/api/types";

/** Calls of the folders API (backend PLAN, item 54), always with the session. */

const base = (workspaceId: string) => `/v1/workspaces/${encodeURIComponent(workspaceId)}/folders`;
const one = (workspaceId: string, id: string) => `${base(workspaceId)}/${encodeURIComponent(id)}`;

/** The workspace's folders by name, each with its number of codes. */
export async function listFolders(workspaceId: string, signal?: AbortSignal): Promise<Folder[]> {
  return (await sessionApi.request<{ folders: Folder[] }>(base(workspaceId), { signal })).folders;
}

export async function createFolder(workspaceId: string, name: string): Promise<Folder> {
  return (await sessionApi.request<{ folder: Folder }>(base(workspaceId), { method: "POST", body: { name } })).folder;
}

export async function renameFolder(workspaceId: string, id: string, name: string): Promise<Folder> {
  return (await sessionApi.request<{ folder: Folder }>(one(workspaceId, id), { method: "PATCH", body: { name } })).folder;
}

/** Deletes the folder; its codes stay, without a folder. */
export async function deleteFolder(workspaceId: string, id: string): Promise<void> {
  await sessionApi.requestVoid(one(workspaceId, id), { method: "DELETE" });
}
