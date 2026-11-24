import { describe, expect, it } from "vitest";
import { authFailure } from "@/features/auth/form-rules";
import { codeFailure } from "@/features/codes/errors";
import { errorText } from "@/features/qr-editor/error-text";
import { en } from "@/i18n/messages/en";
import { vi } from "@/i18n/messages/vi";
import { ApiError } from "@/lib/api";

// Characterization: what each mapper shows for every error code, before and
// after the shared common-error helper. Any difference is a behavior change.
const codes = [
  "rate_limited",
  "busy",
  "network_error",
  "captcha_failed",
  "captcha_unavailable",
  "invalid_credentials",
  "payload_too_large",
  "unsupported_media_type",
  "email_not_verified",
  "code_limit_reached",
  "code_locked",
  "not_found",
  "something_else",
];
const errors = [
  ...codes.map((c) => new ApiError(c === "network_error" ? 0 : 400, c, "x")),
  new ApiError(429, "rate_limited", "x", undefined, 17),
  ...["email", "password", "display_name", "target_url", "name", "fg", "frame_text", "other"].map(
    (f) => new ApiError(422, "validation_error", "x", f),
  ),
];

describe("API error mappers", () => {
  for (const [lang, t] of [["en", en], ["vi", vi]] as const) {
    it(`map every code the same way (${lang})`, () => {
      const rows = errors.map((e) => ({
        code: e.code,
        field: e.field,
        retryAfter: e.retryAfter,
        auth: authFailure(e, t.auth),
        codes: codeFailure(e, t.codes, t.auth),
        generator: errorText(e, t.generator),
      }));
      rows.push({
        code: "non-api",
        field: undefined,
        retryAfter: undefined,
        auth: authFailure(new Error("boom"), t.auth),
        codes: codeFailure(new Error("boom"), t.codes, t.auth),
        generator: "",
      });
      expect(rows).toMatchSnapshot();
    });
  }
});
