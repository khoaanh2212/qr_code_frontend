import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { ApiError } from "@/lib/api";

type T = Messages["generator"];

/** A translated message for an API error, chosen by its code (API messages are English). */
export function errorText(err: ApiError, t: T): string {
  switch (err.code) {
    case "rate_limited":
      return format(t.errors.rateLimited, { seconds: err.retryAfter ?? 60 });
    case "busy":
      return t.errors.busy;
    case "network_error":
      return t.errors.network;
    case "payload_too_large":
      return t.errors.tooLarge;
    case "unsupported_media_type":
      return t.design.logoType;
    case "validation_error":
      return t.validation.invalid;
    default:
      return t.errors.generic;
  }
}
