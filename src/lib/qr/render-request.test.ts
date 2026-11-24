import { describe, expect, it } from "vitest";
import { buildRenderRequest, missingRequired, requestKey, SIGNED_IN_RENDER } from "./render-request";
import { DEFAULT_DESIGN, isPresetCaption, type QrType } from "./types";

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

  it("adds only the style options that differ from the plain look", () => {
    const design = { ...DEFAULT_DESIGN, module: "dots" as const, frame: "box" as const, frameText: "  Scan me  " };
    const r = buildRenderRequest({ ...url, design, format: "svg", size: 512 });
    if (r.method !== "GET") throw new Error("expected GET");
    const q = new URL(r.path, "https://api.test").searchParams;
    expect(q.get("module")).toBe("dots");
    expect(q.get("frame")).toBe("box");
    expect(q.get("frame_text")).toBe("Scan me");
    expect(q.has("eye")).toBe(false);

    const post = buildRenderRequest({ ...url, design: { ...design, frame: "none" }, format: "png", size: 512 }, { post: true });
    if (post.method !== "POST") throw new Error("expected POST");
    // Without a frame its caption is not sent (the API refuses a caption without a frame).
    expect(post.body.style).toEqual({ fg: "#000000", bg: "#ffffff", module: "dots" });
  });

  it("sends eye parts as one value or three, and only colors of their own", () => {
    const design = {
      ...DEFAULT_DESIGN,
      eyeFrames: ["circle", "circle", "circle"] as const,
      eyeBalls: ["square", "diamond", "square"] as const,
      eyeColor: "#1a237e",
      eyeBallColor: "#000000",
    };
    const r = buildRenderRequest({ ...url, design, format: "png", size: 512 });
    if (r.method !== "GET") throw new Error("expected GET");
    const q = new URL(r.path, "https://api.test").searchParams;
    expect(q.get("eye_frame")).toBe("circle");
    expect(q.get("eye_ball")).toBe("square,diamond,square");
    expect(q.get("eye_color")).toBe("#1a237e");
    expect(q.has("eye_ball_color")).toBe(false); // the same as the code color
    expect(q.has("frame_color")).toBe(false);
  });

  it("sends a caption of the user's own to the signed-in render, presets to the public one", () => {
    const framed = { ...DEFAULT_DESIGN, frame: "box" as const };
    const own = buildRenderRequest({ ...url, design: { ...framed, frameText: "Thực đơn" }, format: "png", size: 512 });
    expect(own.method === "POST" && own.path).toBe(SIGNED_IN_RENDER);
    const preset = buildRenderRequest({ ...url, design: { ...framed, frameText: "quét mã" }, format: "png", size: 512 });
    expect(preset.method).toBe("GET");
  });

  it("recognizes presets in any case and composition", () => {
    expect(isPresetCaption("")).toBe(true);
    expect(isPresetCaption(" Scan me ")).toBe(true);
    expect(isPresetCaption("Que\u0301t ma\u0303")).toBe(true);
    expect(isPresetCaption("PAY HERE")).toBe(false);
    expect(isPresetCaption("\u017fcan me")).toBe(false);
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

