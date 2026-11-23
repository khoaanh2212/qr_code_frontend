import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { vi as viMessages } from "@/i18n/messages/vi";
import { ApiError } from "@/lib/api/client";
import { errorText } from "./error-text";

const t = en.generator;

describe("errorText", () => {
  it.each([
    [new ApiError(429, "rate_limited", "x", undefined, 12), "Too many requests. Try again in 12 seconds."],
    [new ApiError(429, "rate_limited", "x"), "Too many requests. Try again in 60 seconds."],
    [new ApiError(503, "busy", "x"), t.errors.busy],
    [new ApiError(0, "network_error", "x"), t.errors.network],
    [new ApiError(413, "payload_too_large", "x"), t.errors.tooLarge],
    [new ApiError(415, "unsupported_media_type", "x"), t.design.logoType],
    [new ApiError(422, "validation_error", "url must start with http", "url"), t.validation.invalid],
    [new ApiError(500, "internal", "boom"), t.errors.generic],
  ])("%s", (err, want) => {
    expect(errorText(err, t)).toBe(want);
  });

  it("never shows the API's English message", () => {
    const err = new ApiError(422, "validation_error", "url must start with http", "url");
    expect(errorText(err, viMessages.generator)).toBe(viMessages.generator.validation.invalid);
  });
});
