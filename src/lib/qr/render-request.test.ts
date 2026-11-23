import { describe, expect, it } from "vitest";
import { buildRenderRequest, missingRequired, requestKey } from "./render-request";
import { DEFAULT_DESIGN, type QrType } from "./types";

const url = { type: "url", data: { url: "https://example.com/a?b=1" } };

describe("buildRenderRequest", () => {
  it("uses a cacheable GET for plain content", () => {
    const r = buildRenderRequest({ ...url, design: DEFAULT_DESIGN, format: "png", size: 512 });
    expect(r.method).toBe("GET");
    if (r.method !== "GET") return;
    const q = new URL(r.path, "https://api.test").searchParams;
    expect(Object.fromEntries(q)).toEqual({
      type: "url",
      format: "png",
      size: "512",
      margin: "4",
      ecc: "M",
      fg: "000000",
      bg: "ffffff",
      url: "https://example.com/a?b=1",
    });
    expect(r.path.startsWith("/v1/qr/render?")).toBe(true);
  });

  it("encodes a leading + so it is not read as a space", () => {
    const r = buildRenderRequest({ type: "phone", data: { phone: "+84 912" }, design: DEFAULT_DESIGN, format: "svg", size: 256 });
    expect(r.method === "GET" && r.path).toContain("phone=%2B84+912");
  });

  it.each(["wifi", "vcard"])("keeps %s content out of URLs (POST)", (type) => {
    const r = buildRenderRequest({ type, data: { ssid: "Office", password: "secret-pass" }, design: DEFAULT_DESIGN, format: "png", size: 512 });
    expect(r.method).toBe("POST");
    expect(r.path).toBe("/v1/qr/render");
  });

  it("posts a logo and forces error correction H", () => {
    const r = buildRenderRequest({
      ...url,
      design: { ...DEFAULT_DESIGN, ecc: "L", logo: { base64: "AAAA", name: "x.png", id: "l1" } },
      format: "png",
      size: 512,
    });
    expect(r).toEqual({
      method: "POST",
      path: "/v1/qr/render",
      body: {
        type: "url",
        data: { url: "https://example.com/a?b=1" },
        format: "png",
        size: 512,
        margin: 4,
        ecc: "H",
        style: { fg: "#000000", bg: "#ffffff", logo_base64: "AAAA" },
      },
    });
  });

  it("never sends a password for an open network", () => {
    const r = buildRenderRequest({
      type: "wifi",
      data: { ssid: "Cafe", encryption: "nopass", password: "left-over" },
      design: DEFAULT_DESIGN,
      format: "png",
      size: 512,
    });
    expect(r.method === "POST" && r.body.data).toEqual({ ssid: "Cafe", encryption: "nopass" });
  });

  it("can be forced to POST (downloads)", () => {
    expect(buildRenderRequest({ ...url, design: DEFAULT_DESIGN, format: "svg", size: 1024 }, { post: true }).method).toBe("POST");
  });

  it("drops empty and whitespace-only fields", () => {
    const r = buildRenderRequest(
      { type: "email", data: { to: "a@b.co", subject: "  ", body: "" }, design: DEFAULT_DESIGN, format: "png", size: 512 },
      { post: true },
    );
    expect(r.method === "POST" && r.body.data).toEqual({ to: "a@b.co" });
  });
});

describe("missingRequired", () => {
  const wifi: QrType = {
    type: "wifi",
    fields: [
      { name: "ssid", required: true },
      { name: "password", required: false },
    ],
  };
  const vcard: QrType = {
    type: "vcard",
    fields: [
      { name: "first_name", required: false },
      { name: "last_name", required: false },
      { name: "organization", required: false },
      { name: "email", required: false },
    ],
  };

  it("lists empty required fields; a secured network needs its password", () => {
    expect(missingRequired(wifi, { ssid: " ", encryption: "WPA", password: "secret-pass" })).toEqual(["ssid"]);
    expect(missingRequired(wifi, { ssid: "Office", encryption: "WPA" })).toEqual(["password"]);
    expect(missingRequired(wifi, { ssid: "Office", encryption: "WPA", password: "secret-pass" })).toEqual([]);
    expect(missingRequired(wifi, { ssid: "Office", encryption: "nopass" })).toEqual([]);
    expect(missingRequired(wifi, { ssid: "Office", encryption: "WEP", password: "" })).toEqual(["password"]);
  });

  it("needs one of the vCard name fields", () => {
    expect(missingRequired(vcard, { email: "a@b.co" })).toEqual(["first_name"]);
    expect(missingRequired(vcard, { organization: "ACME" })).toEqual([]);
  });
});

describe("requestKey", () => {
  it("identifies a logo by id, not by its bytes", () => {
    const withLogo = (base64: string, id: string) =>
      buildRenderRequest({ ...url, design: { ...DEFAULT_DESIGN, logo: { base64, name: "l.png", id } }, format: "png", size: 512 });
    const a = requestKey(withLogo("A".repeat(1000), "1"), "1");
    expect(a).not.toContain("AAAA");
    expect(a).not.toBe(requestKey(withLogo("B", "2"), "2"));
    expect(requestKey(buildRenderRequest({ ...url, design: DEFAULT_DESIGN, format: "png", size: 512 }))).toMatch(/^\/v1\/qr\/render\?/);
  });
});

