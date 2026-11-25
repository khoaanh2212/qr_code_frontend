import { sessionApi } from "@/lib/api";
import type { MfaChange, MfaStatus, NewPasskey, PasskeyCreation, TotpSetup } from "@/lib/api/types";

// Two-step verification of the caller's account (/v1/me/mfa). Every change needs a step-up from
// the last 5 minutes (POST /v1/me/reauth, or Google for an account without a password); without
// it the API answers 403 reauth_required.

export function mfaStatus() {
  return sessionApi.request<{ mfa: MfaStatus }>("/v1/me/mfa");
}

/** The step-up: opens a 5-minute window for changes on this session. */
export function reauth(password: string) {
  return sessionApi.requestVoid("/v1/me/reauth", { method: "POST", body: { password } });
}

export function beginTotp() {
  return sessionApi.request<{ totp: TotpSetup }>("/v1/me/mfa/totp", { method: "POST" });
}

export function confirmTotp(code: string) {
  return sessionApi.request<MfaChange>("/v1/me/mfa/totp/confirm", { method: "POST", body: { code } });
}

export function removeTotp() {
  return sessionApi.request<MfaChange>("/v1/me/mfa/totp", { method: "DELETE" });
}

export function passkeyCreationOptions() {
  return sessionApi.request<PasskeyCreation>("/v1/me/mfa/passkeys/options", { method: "POST" });
}

export function addPasskey(body: NewPasskey) {
  return sessionApi.request<MfaChange>("/v1/me/mfa/passkeys", { method: "POST", body });
}

export function removePasskey(id: string) {
  return sessionApi.request<MfaChange>(`/v1/me/mfa/passkeys/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function regenerateRecoveryCodes() {
  return sessionApi.request<{ recovery_codes: string[] }>("/v1/me/mfa/recovery-codes", { method: "POST" });
}

/**
 * The setup's otpauth:// link as a QR code, drawn by our own API. POST keeps the secret out of
 * URLs, logs and caches; it never goes to a third party.
 */
export function totpQrCode(uri: string) {
  return sessionApi.requestBlob("/v1/qr/render", {
    method: "POST",
    body: { type: "text", data: { text: uri }, format: "svg", size: 240, margin: 2, ecc: "M" },
  });
}
