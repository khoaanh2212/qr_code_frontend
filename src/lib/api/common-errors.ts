import { format } from "@/i18n/config";
import { ApiError } from "./client";

/**
 * Messages for the API errors every form can meet. A message catalog passes the ones it has; a
 * code without a message here is left to the caller (usually its generic message), so each form
 * keeps exactly the texts it showed before.
 */
export interface CommonErrorMessages {
  rateLimited?: string;
  busy?: string;
  network?: string;
  captchaFailed?: string;
  captchaUnavailable?: string;
}

/** Seconds to wait when a 429 or 503 carries no Retry-After. */
export const DEFAULT_RETRY_AFTER_SECONDS = 60;

/** The error as an ApiError; anything else (a thrown TypeError, …) counts as a network failure. */
export function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError(0, "network_error", "");
}

/** The translated message for a common API error, or undefined when the caller handles the code. */
export function commonErrorMessage(err: ApiError, m: CommonErrorMessages): string | undefined {
  switch (err.code) {
    case "rate_limited":
      return m.rateLimited && format(m.rateLimited, { seconds: err.retryAfter ?? DEFAULT_RETRY_AFTER_SECONDS });
    case "busy":
      return m.busy;
    case "network_error":
      return m.network;
    case "captcha_failed":
      return m.captchaFailed;
    case "captcha_unavailable":
      return m.captchaUnavailable;
    default:
      return undefined;
  }
}
