import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it.each([
    ["/app", "/app"],
    ["/app/codes/1?tab=stats#top", "/app/codes/1?tab=stats#top"],
    ["/wifi-qr-code", "/wifi-qr-code"],
    ["/vi/app", "/vi/app"],
    ["/de/app/codes/1", "/de/app/codes/1"],
  ])("keeps the in-site path %s", (raw, want) => {
    expect(safeReturnTo(raw)).toBe(want);
  });

  it.each([
    null,
    undefined,
    "",
    "app",
    "//evil.com",
    "//evil.com/app",
    "/\\evil.com",
    "\\\\evil.com",
    "/app\\..\\..\\evil",
    "https://evil.com/app",
    "javascript:alert(1)",
    "/\t/evil.com",
    "/app\n",
    " /app",
    "/login",
    "/login?return_to=/app",
    "/register",
    "/vi/login",
    "/de/register?x=1",
    "/vi/%6cogin",
    "/.//evil.com",
    "/..//evil.com",
    "/a/..//evil.com",
    "/%2e//evil.com",
    "/app/..//evil.com",
    "/app/../login",
    "/%6cogin",
    "/login%2F",
    "/app%2F%2Fevil.com",
    "/app/%2e%2e/login",
    "/app%5Cevil",
    "/%E0%A4%A",
    "/" + "a".repeat(2048),
  ])("falls back for %j", (raw) => {
    expect(safeReturnTo(raw)).toBe("/app");
  });

  it("uses the given fallback", () => {
    expect(safeReturnTo("//evil.com", "/")).toBe("/");
  });
});
