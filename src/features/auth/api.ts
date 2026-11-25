import { sessionApi } from "@/lib/api";
import type { LoginResponse, MfaLoginStep, PendingLogin, User, WebAuthnOptions } from "@/lib/api/types";

// The account endpoints of /v1/auth, in one place. Every call sends the session cookie (the
// private surface only).

export function login(body: { email: string; password: string }) {
  return sessionApi.request<LoginResponse>("/v1/auth/login", { method: "POST", body });
}

/** The login waiting for its second step (the pending cookie); uses nothing up. */
export function pendingLogin() {
  return sessionApi.request<PendingLogin>("/v1/auth/login/mfa", { method: "GET" });
}

/** The WebAuthn options of the passkey second step. */
export function passkeyLoginOptions() {
  return sessionApi.request<{ passkey: WebAuthnOptions }>("/v1/auth/login/mfa/options", { method: "POST" });
}

/** The second login step; opens the session. */
export function finishLogin(body: MfaLoginStep) {
  return sessionApi.request<{ user: User }>("/v1/auth/login/mfa", { method: "POST", body });
}

export function register(body: Record<string, string>) {
  return sessionApi.request("/v1/auth/register", { method: "POST", body });
}

export function forgotPassword(body: { email: string; captcha_token: string }) {
  return sessionApi.request("/v1/auth/forgot-password", { method: "POST", body });
}

export function resetPassword(body: { token: string; password: string }) {
  return sessionApi.request("/v1/auth/reset-password", { method: "POST", body });
}

export function resendVerification(body: { email: string; captcha_token: string }) {
  return sessionApi.request("/v1/auth/resend-verification", { method: "POST", body });
}

export function logout() {
  return sessionApi.requestVoid("/v1/auth/logout", { method: "POST" });
}
