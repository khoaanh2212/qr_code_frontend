import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function run(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers }));
}

function scriptSrc(csp: string | null): string {
  return csp?.split(";").find((d) => d.trim().startsWith("script-src"))?.trim() ?? "";
}

describe("proxy", () => {
  it.each(["/app", "/app/codes/1", "/login", "/verify-email", "/vi/app", "/de/login"])("locks down the private page %s", (path) => {
    const res = run(path);
    expect(scriptSrc(res.headers.get("Content-Security-Policy"))).toMatch(/'nonce-[^']+' 'strict-dynamic'$/);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("passes the same nonce to the renderer as it sends to the browser", () => {
    const res = run("/login");
    const sent = res.headers.get("Content-Security-Policy");
    // NextResponse.next({ request: { headers } }) forwards request headers as x-middleware-request-*.
    expect(res.headers.get("x-middleware-request-content-security-policy")).toBe(sent);
    const nonce = /'nonce-([^']+)'/.exec(sent ?? "")?.[1];
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
  });

  it("uses a fresh nonce for every request", () => {
    const a = scriptSrc(run("/app").headers.get("Content-Security-Policy"));
    const b = scriptSrc(run("/app").headers.get("Content-Security-Policy"));
    expect(a).not.toBe(b);
  });

  it.each(["/", "/wifi-qr-code", "/apple", "/vi", "/fr/wifi-qr-code"])("leaves the public page %s cacheable and without a nonce", (path) => {
    const res = run(path);
    expect(res.headers.get("Content-Security-Policy")).not.toContain("nonce-");
    expect(res.headers.get("X-Robots-Tag")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("locks down private pages requested as prefetches too", () => {
    const res = run("/app", { "next-router-prefetch": "1", purpose: "prefetch" });
    expect(res.headers.get("Content-Security-Policy")).toContain("nonce-");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it.each([
    ["/", "/en"],
    ["/login", "/en/login"],
    ["/app/codes/1", "/en/app/codes/1"],
    ["/wifi-qr-code", "/en/wifi-qr-code"],
  ])("serves the English page for %s from %s", (path, internal) => {
    const res = run(path + "?x=1");
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "").pathname).toBe(internal);
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "").search).toBe("?x=1");
  });

  it.each(["/vi", "/vi/login", "/de/app"])("passes the prefixed path %s through", (path) => {
    const res = run(path);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    ["/en", "/"],
    ["/en/login?return_to=%2Fapp", "/login?return_to=%2Fapp"],
    ["/en/app/codes/1", "/app/codes/1"],
  ])("redirects %s to the unprefixed URL %s", (path, want) => {
    const res = run(path);
    expect(res.status).toBe(308);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname + location.search).toBe(want);
  });

  it("serves the English share image under /en without a redirect", () => {
    const res = run("/en/opengraph-image-1fzwx8?abc");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

