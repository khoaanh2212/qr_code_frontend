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
  it.each(["/app", "/app/codes/1", "/login", "/verify-email"])("locks down the private page %s", (path) => {
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

  it.each(["/", "/wifi-qr-code", "/apple"])("leaves the public page %s cacheable and without a nonce", (path) => {
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
});
