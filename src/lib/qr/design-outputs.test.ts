import { describe, expect, it } from "vitest";
import { buildRenderRequest, requestKey } from "./render-request";
import { DEFAULT_DESIGN, designScannable, formatProblem, GRADIENT_ANGLE_MAX, type QrDesign } from "./types";

const url = { type: "url", data: { url: "https://example.com" } };

function query(design: QrDesign): URLSearchParams {
  const r = buildRenderRequest({ ...url, design, format: "png", size: 512 });
  if (r.method !== "GET") throw new Error("expected GET");
  return new URL(r.path, "https://api.test").searchParams;
}

describe("gradients", () => {
  const linear: QrDesign = { ...DEFAULT_DESIGN, gradient: "linear", fg2: "#0f766e", gradientAngle: 90 };

  it("sends nothing for a solid color, so plain URLs stay cached", () => {
    const q = query({ ...DEFAULT_DESIGN, fg2: "#0f766e", gradientAngle: 45 });
    expect(q.has("gradient")).toBe(false);
    expect(q.has("fg2")).toBe(false);
    expect(q.has("gradient_angle")).toBe(false);
  });

  it("sends two colors and the angle of a linear gradient on GET", () => {
    const q = query(linear);
    expect(q.get("gradient")).toBe("linear");
    expect(q.get("fg2")).toBe("0f766e");
    expect(q.get("gradient_angle")).toBe("90");
  });

  it("leaves out the default angle and any angle of a radial gradient", () => {
    expect(query({ ...linear, gradientAngle: 0 }).has("gradient_angle")).toBe(false);
    const q = query({ ...linear, gradient: "radial" });
    expect(q.get("gradient")).toBe("radial");
    expect(q.has("gradient_angle")).toBe(false);
  });

  it("sends the angle as a number on POST", () => {
    const r = buildRenderRequest({ ...url, design: linear, format: "png", size: 512 }, { post: true });
    if (r.method !== "POST") throw new Error("expected POST");
    expect(r.body.style).toMatchObject({ gradient: "linear", fg2: "#0f766e", gradient_angle: 90 });
  });

  it("renders stored stops with POST only (GET refuses them), without fg2", () => {
    const stops = [
      { offset: 0, color: "#0b2a6f" },
      { offset: 40, color: "#6d108a" },
      { offset: 100, color: "#0a5c36" },
    ];
    const r = buildRenderRequest({ ...url, design: { ...linear, gradientStops: stops }, format: "png", size: 512 });
    if (r.method !== "POST") throw new Error("expected POST");
    expect(r.body.style.gradient_stops).toEqual(stops);
    expect(r.body.style).not.toHaveProperty("fg2");
    expect(requestKey(r)).toContain("#6d108a");
  });

  it("holds the second color and every stop to the contrast rule", () => {
    expect(designScannable(linear)).toBe(true);
    expect(designScannable({ ...linear, fg2: "#eeeeee" })).toBe(false);
    // A light second color is ignored while the fill is solid.
    expect(designScannable({ ...DEFAULT_DESIGN, fg2: "#eeeeee" })).toBe(true);
    const stops = [
      { offset: 0, color: "#000000" },
      { offset: 100, color: "#fafafa" },
    ];
    expect(designScannable({ ...linear, gradientStops: stops })).toBe(false);
  });

  it("caps the angle at 359", () => {
    expect(GRADIENT_ANGLE_MAX).toBe(359);
  });
});

describe("transparent background", () => {
  const clear: QrDesign = { ...DEFAULT_DESIGN, transparent: true, bg: "#fde68a" };

  it("sends bg=transparent on GET and POST", () => {
    expect(query(clear).get("bg")).toBe("transparent");
    const r = buildRenderRequest({ ...url, design: clear, format: "png", size: 512 }, { post: true });
    if (r.method !== "POST") throw new Error("expected POST");
    expect(r.body.style.bg).toBe("transparent");
  });

  it("checks colors against white paper, not the hidden background color", () => {
    // Dark yellow on the light yellow background fails, but it reads on white.
    expect(designScannable({ ...DEFAULT_DESIGN, fg: "#b08400", bg: "#fde68a" })).toBe(false);
    expect(designScannable({ ...clear, fg: "#b08400" })).toBe(true);
    // White-ish codes never pass, whatever the background was.
    expect(designScannable({ ...clear, fg: "#f5f5f5", bg: "#000000" })).toBe(false);
  });
});

describe("formatProblem", () => {
  it("refuses JPG with a transparent background (JPEG has no transparency)", () => {
    expect(formatProblem({ ...DEFAULT_DESIGN, transparent: true }, "jpg")).toBe("jpgTransparent");
    expect(formatProblem({ ...DEFAULT_DESIGN, transparent: true }, "png")).toBeNull();
  });

  it("refuses EPS with an uploaded logo, but not with a built-in icon", () => {
    const logo = { base64: "AAAA", name: "logo.png", id: "1" };
    expect(formatProblem({ ...DEFAULT_DESIGN, logo }, "eps")).toBe("epsLogo");
    expect(formatProblem({ ...DEFAULT_DESIGN, logoIcon: "star" }, "eps")).toBeNull();
    expect(formatProblem({ ...DEFAULT_DESIGN, logo }, "pdf")).toBeNull();
  });
});
