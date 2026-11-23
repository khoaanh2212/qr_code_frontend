import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { validEmail } from "@/lib/forms/email";

export type AuthMessages = Messages["auth"];

/** The API's password rule: at least 10 characters, at most 256 bytes. */
export const PASSWORD_MIN_CHARS = 10;
const PASSWORD_MAX_BYTES = 256;

export function emailError(value: string, t: AuthMessages): string | undefined {
  const v = value.trim();
  if (v === "") return t.errors.required;
  if (!validEmail(v)) return t.errors.emailInvalid;
  return undefined;
}

/** For new passwords (sign-up, reset). Login only checks that something was typed. */
export function newPasswordError(value: string, t: AuthMessages): string | undefined {
  if (value === "") return t.errors.required;
  if ([...value].length < PASSWORD_MIN_CHARS) return t.errors.passwordShort;
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return t.errors.passwordLong;
  return undefined;
}

export interface AuthFailure {
  /** Shown at a field when the API names one. */
  field?: "email" | "password" | "display_name";
  message: string;
}

/** A translated message for an API error, chosen by its code; API messages are English. */
export function authFailure(err: unknown, t: AuthMessages): AuthFailure {
  const e = err instanceof ApiError ? err : new ApiError(0, "network_error", "");
  switch (e.code) {
    case "invalid_credentials":
      return { message: t.errors.invalidCredentials };
    case "captcha_failed":
      return { message: t.errors.captchaFailed };
    case "captcha_unavailable":
      return { message: t.errors.captchaUnavailable };
    case "rate_limited":
      return { message: format(t.errors.rateLimited, { seconds: e.retryAfter ?? 60 }) };
    case "busy":
      return { message: t.errors.busy };
    case "network_error":
      return { message: t.errors.network };
    case "validation_error":
      if (e.field === "email") return { field: "email", message: t.errors.emailInvalid };
      if (e.field === "password") return { field: "password", message: t.errors.passwordShort };
      if (e.field === "display_name") return { field: "display_name", message: t.errors.generic };
      return { message: t.errors.generic };
    default:
      return { message: t.errors.generic };
  }
}
