import type { Messages } from "@/i18n/messages";
import { commonErrorMessage, type ApiError } from "@/lib/api";

type T = Messages["generator"];

/** A translated message for an API error, chosen by its code (API messages are English). */
export function errorText(err: ApiError, t: T): string {
  const common = commonErrorMessage(err, t.errors);
  if (common !== undefined) return common;
  switch (err.code) {
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
