import { sessionApi } from "@/lib/api";

// The account endpoints of /v1/auth, in one place. Every call sends the session cookie (the
// private surface only).

export function login(body: { email: string; password: string }) {
  return sessionApi.request("/v1/auth/login", { method: "POST", body });
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
