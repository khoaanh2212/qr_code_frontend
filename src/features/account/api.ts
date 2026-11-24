import { sessionApi } from "@/lib/api";
import type { MeResponse } from "@/lib/api/types";

// The caller's own account (/v1/me), in one place.

export function updateProfile(body: { display_name: string }) {
  return sessionApi.request<MeResponse>("/v1/me", { method: "PATCH", body });
}

export function revokeSession(id: string) {
  return sessionApi.requestVoid(`/v1/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function unlinkGoogle() {
  return sessionApi.requestVoid("/v1/me/identities/google", { method: "DELETE" });
}

export function changePassword(body: { current_password: string; new_password: string }) {
  return sessionApi.requestVoid("/v1/me/password", { method: "POST", body });
}

/** Deletes the account: with the password, or `{}` after a Google re-authentication. */
export function deleteAccount(body: { password?: string }) {
  return sessionApi.requestVoid("/v1/me", { method: "DELETE", body });
}
