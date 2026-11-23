import { describe, expect, it } from "vitest";
import { switchLocaleUrl } from "./language-switcher";

describe("switchLocaleUrl", () => {
  it.each([
    ["de", "/", "", "/de"],
    ["en", "/vi", "", "/"],
    ["vi", "/login", "", "/vi/login"],
    ["en", "/vi/app/codes/1", "?tab=stats", "/app/codes/1?tab=stats"],
    ["de", "/vi/login", "?return_to=%2Fvi%2Fapp", "/de/login?return_to=%2Fde%2Fapp"],
    ["en", "/vi/login", "?return_to=%2Fvi%2Fapp%3Fx%3D1", "/login?return_to=%2Fapp%3Fx%3D1"],
    ["vi", "/login", "?return_to=%2F%2Fevil.com", "/vi/login"],
    ["vi", "/login", "?return_to=%2F%5Cevil", "/vi/login"],
    ["es", "/vi/login", "?return_to=%2Fvi%3Fx%3D1", "/es/login?return_to=%2Fes%3Fx%3D1"],
    ["de", "//evil.com", "", "/de"],
    ["vi", "/app", "?a=1", "/vi/app?a=1"],
    ["en", "//evil.com", "", "/"],
  ] as const)("%s %s%s -> %s", (target, path, search, want) => {
    expect(switchLocaleUrl(target, path, search)).toBe(want);
  });

  it("keeps the fragment", () => {
    expect(switchLocaleUrl("vi", "/reset-password", "", "#token=abc")).toBe("/vi/reset-password#token=abc");
  });
});
