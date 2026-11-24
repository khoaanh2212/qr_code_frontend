import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError } from "@/lib/api/client";
import { authFailure, emailError, newPasswordError } from "./form-rules";

const t = en.auth;

describe("auth form rules", () => {
  it("checks emails like the API", () => {
    expect(emailError("", t)).toBe(t.errors.required);
    expect(emailError("a@b", t)).toBe(t.errors.emailInvalid);
    expect(emailError(" a@example.com ", t)).toBeUndefined();
  });

  it("checks new passwords like the API (10 characters, 256 bytes)", () => {
    expect(newPasswordError("", t)).toBe(t.errors.required);
    expect(newPasswordError("123456789", t)).toBe(t.errors.passwordShort);
    expect(newPasswordError("mật-khẩu-10", t)).toBeUndefined(); // 11 characters, more bytes
    expect(newPasswordError("🙂".repeat(9), t)).toBe(t.errors.passwordShort); // 9 characters, 36 bytes
    expect(newPasswordError("é".repeat(129), t)).toBe(t.errors.passwordLong); // 258 bytes
  });

  it.each([
    [new ApiError(401, "invalid_credentials", "x"), { message: t.errors.invalidCredentials }],
    [new ApiError(429, "rate_limited", "x", undefined, 30), { message: "Too many attempts. Try again in 30 seconds." }],
    [new ApiError(400, "captcha_failed", "x"), { message: t.errors.captchaFailed }],
    [new ApiError(422, "validation_error", "email must be valid", "email"), { field: "email", message: t.errors.emailInvalid }],
    [new ApiError(500, "internal", "boom"), { message: t.errors.generic }],
    [new TypeError("x"), { message: t.errors.network }],
  ])("maps %s", (err, want) => {
    expect(authFailure(err, t)).toEqual(want);
  });
});
