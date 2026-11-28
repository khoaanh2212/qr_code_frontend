import { describe, expect, it } from "vitest";
import { buildCsp, hostsCaptcha, surfaceFor } from "./csp";

const api = "https://api.example.com";

function directives(csp: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out.set(name, values);
  }
  return out;
}

describe("surfaceFor", () => {
  it.each([
    ["/app", "private"],
    ["/app/", "private"],
    ["/app/codes/123", "private"],
    ["/login", "private"],
    ["/register", "private"],
    ["/forgot-password", "private"],
    ["/reset-password", "private"],
    ["/verify-email", "private"],
    ["/report", "private"],
    ["/vi/report", "private"],
    ["/login/", "private"],
    ["/vi/app", "private"],
    ["/de/app/codes/1", "private"],
    ["/vi/login", "private"],
    ["/en/app", "private"],
    ["/vi", "marketing"],
    ["/vi/wifi-qr-code", "marketing"],
    ["/vi/apple", "marketing"],
    ["/xx/app", "marketing"],
    ["/", "marketing"],
    ["/wifi-qr-code", "marketing"],
    ["/apple", "marketing"],
    ["/application", "marketing"],
    ["/login-help", "marketing"],
    ["/pricing", "marketing"],
  ] as const)("%s is %s", (path, want) => {
    expect(surfaceFor(path)).toBe(want);
  });
});

describe("buildCsp", () => {
  it("private pages allow only nonced scripts", () => {
    const d = directives(
      buildCsp({ surface: "private", nonce: "bm9uY2UtMTIz", apiOrigin: api, dev: false }),
    );
    expect(d.get("script-src")).toEqual(["'self'", "'nonce-bm9uY2UtMTIz'", "'strict-dynamic'"]);
    expect(d.get("connect-src")).toEqual(["'self'", api]);
    expect(d.get("frame-ancestors")).toEqual(["'none'"]);
    expect(d.get("frame-src")).toEqual([api, "https://www.youtube-nocookie.com", "https://player.vimeo.com"]);
    expect(d.get("object-src")).toEqual(["'none'"]);
    expect(d.get("base-uri")).toEqual(["'none'"]);
    expect(d.get("form-action")).toEqual(["'self'"]);
    expect(d.has("upgrade-insecure-requests")).toBe(true);
  });

  it("private pages refuse to build without a nonce", () => {
    expect(() => buildCsp({ surface: "private", apiOrigin: api, dev: false })).toThrow(/nonce/);
  });

  it("marketing pages carry no nonce, so they stay cacheable", () => {
    const csp = buildCsp({ surface: "marketing", nonce: "bm9uY2UtMTIz", apiOrigin: api, dev: false });
    expect(csp).not.toContain("nonce-");
    expect(directives(csp).get("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    // Only the API's sample pages (the generator's page tabs show them), nothing else.
    expect(directives(csp).get("frame-src")).toEqual([`${api}/v1/page-types/`]);
  });

  it("never allows eval outside development", () => {
    for (const surface of ["private", "marketing"] as const) {
      const csp = buildCsp({ surface, nonce: "bm9uY2UtMTIz", apiOrigin: api, dev: false });
      expect(csp).not.toContain("unsafe-eval");
    }
  });

  it("development allows eval", () => {
    const csp = buildCsp({
      surface: "private",
      nonce: "bm9uY2UtMTIz",
      apiOrigin: "http://localhost:8080",
      dev: true,
    });
    const d = directives(csp);
    expect(d.get("script-src")).toContain("'unsafe-eval'");
  });

  it("does not upgrade requests to a plain-http API (local builds)", () => {
    const csp = buildCsp({ surface: "marketing", apiOrigin: "http://localhost:8080", dev: false });
    expect(directives(csp).has("upgrade-insecure-requests")).toBe(false);
  });

  it("allows API images for QR previews", () => {
    const d = directives(buildCsp({ surface: "marketing", apiOrigin: api, dev: false }));
    expect(d.get("img-src")).toEqual(["'self'", "blob:", "data:", api]);
  });

  it.each(["https://api.example.com/path", "javascript:alert(1)", "https://a.com; script-src *", ""])(
    "rejects a malformed API origin %j",
    (origin) => {
      expect(() => buildCsp({ surface: "marketing", apiOrigin: origin, dev: false })).toThrow();
    },
  );

  it.each(["abc def", "abc'", "abc;", ""])("rejects a malformed nonce %j", (nonce) => {
    expect(() => buildCsp({ surface: "private", nonce, apiOrigin: api, dev: false })).toThrow();
  });
});

describe("captcha frames", () => {
  it.each([
    ["/register", true],
    ["/vi/register", true],
    ["/forgot-password", true],
    ["/report", true],
    ["/pt/report", true],
    ["/de/verify-email", true],
    ["/login", false],
    ["/reset-password", false],
    ["/app", false],
    ["/app/account", true],
    ["/vi/app/account", true],
    ["/app/account/security", false],
    ["/app/codes/new", true],
    ["/pt/app/codes/new", true],
    ["/app/codes", false],
    ["/registered", false],
  ])("%s hosts the captcha: %s", (path, want) => {
    expect(hostsCaptcha(path)).toBe(want);
  });

  it("frames Turnstile only when asked, and never on public pages", () => {
    const frames = (surface: "private" | "marketing", captcha: boolean) =>
      buildCsp({ surface, captcha, nonce: "bm9uY2UtMTIz", apiOrigin: api, dev: false })
        .split(";")
        .find((d) => d.trim().startsWith("frame-src"))
        ?.trim();
    // Private pages frame the page editor's samples (on the API) and its previews' video players.
    const editor = `${api} https://www.youtube-nocookie.com https://player.vimeo.com`;
    expect(frames("private", true)).toBe(`frame-src ${editor} https://challenges.cloudflare.com`);
    expect(frames("private", false)).toBe(`frame-src ${editor}`);
    expect(frames("marketing", true)).toBe(`frame-src ${api}/v1/page-types/`);
  });

  it("lets the app read and show the files host's files on the private surface", () => {
    const csp = buildCsp({ surface: "private", nonce: "bm9uY2UtMTIz", apiOrigin: api, filesOrigin: "https://files.qr.example.com", dev: false });
    expect(csp).toContain("img-src 'self' blob: data: " + api + " https://files.qr.example.com");
    expect(csp).toContain("connect-src 'self' " + api + " https://files.qr.example.com");
    // A page preview's sound plays from the files host (the page editor, item 27c).
    expect(csp).toContain("media-src https://files.qr.example.com");
    const marketing = buildCsp({ surface: "marketing", apiOrigin: api, filesOrigin: "https://files.qr.example.com", dev: false });
    expect(marketing).not.toContain("files.qr.example.com");
    expect(() => buildCsp({ surface: "private", nonce: "bm9uY2UtMTIz", apiOrigin: api, filesOrigin: "https://x.com/a", dev: false })).toThrow();
  });
});
