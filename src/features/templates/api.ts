import { sessionApi } from "@/lib/api";
import type { CodeDesign, DesignTemplate } from "@/lib/api/types";

/** Calls of the design templates API (backend PLAN, item 48), always with the session. */

const base = (workspaceId: string) => `/v1/workspaces/${encodeURIComponent(workspaceId)}/design-templates`;

export async function listTemplates(workspaceId: string, signal?: AbortSignal): Promise<DesignTemplate[]> {
  return (await sessionApi.request<{ templates: DesignTemplate[] }>(base(workspaceId), { signal })).templates;
}

export async function createTemplate(workspaceId: string, name: string, design: CodeDesign): Promise<DesignTemplate> {
  const r = await sessionApi.request<{ template: DesignTemplate }>(base(workspaceId), { method: "POST", body: { name, design } });
  return r.template;
}

export async function renameTemplate(workspaceId: string, id: string, name: string): Promise<DesignTemplate> {
  const r = await sessionApi.request<{ template: DesignTemplate }>(`${base(workspaceId)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { name },
  });
  return r.template;
}

export async function deleteTemplate(workspaceId: string, id: string): Promise<void> {
  await sessionApi.requestVoid(`${base(workspaceId)}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
