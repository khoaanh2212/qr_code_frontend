import { describe, expect, it } from "vitest";
import { designFromLook, DEFAULT_LOOK, lookFromDesign, lookScannable, safeLook } from "./design";

describe("code designs", () => {
  it("reads designs saved with the eye shorthand", () => {
    const look = lookFromDesign({ fg: "#112233", eye: "leaf" });
    expect(look.eyeFrames).toEqual(["leaf", "leaf", "leaf"]);
    expect(look.eyeBalls).toEqual(["leaf", "leaf", "leaf"]);
  });

  it("round-trips eye parts and own colors in the API's form", () => {
    const look = lookFromDesign({
      eye_frame: "circle,square,pointed",
      eye_ball: "diamond",
      eye_color: "#1A237E",
      frame: "box",
      frame_color: "#0b5d1e",
    });
    expect(look.eyeFrames).toEqual(["circle", "square", "pointed"]);
    expect(look.eyeColor).toBe("#1a237e");
    const design = designFromLook(look, { margin: 1, ecc: "Q" });
    expect(design).toMatchObject({
      eye_frame: "circle,square,pointed",
      eye_ball: "diamond,diamond,square", // a diamond center cannot sit in the pointed ring
      eye_color: "#1a237e",
      frame: "box",
      frame_color: "#0b5d1e",
      ecc: "Q",
      margin: 2, // a frame needs a quiet zone of 2
    });
    expect(design).not.toHaveProperty("eye");
  });

  it("keeps a built-in icon, drops an unknown one", () => {
    expect(lookFromDesign({ logo_icon: "star" }).logoIcon).toBe("star");
    expect(lookFromDesign({ logo_icon: "rocket" }).logoIcon).toBe("");
    expect(designFromLook({ ...DEFAULT_LOOK, logoIcon: "heart" })).toMatchObject({ logo_icon: "heart" });
    expect(safeLook({ logoIcon: "<svg>" })).toEqual({});
  });

  it("does not send a part color equal to the code color", () => {
    expect(designFromLook({ ...DEFAULT_LOOK, eyeColor: "#000000" })).not.toHaveProperty("eye_color");
  });

  it("checks the contrast of every part color", () => {
    expect(lookScannable({ ...DEFAULT_LOOK, eyeBallColor: "#eeeeee" })).toBe(false);
    expect(lookScannable({ ...DEFAULT_LOOK, frame: "box", frameColor: "#0b5d1e" })).toBe(true);
  });

  it("keeps only valid hand-off values, never a refused eye pair", () => {
    expect(
      safeLook({
        eyeFrames: ["pointed", "square", "square"],
        eyeBalls: ["diamond", "square", "square"],
        eyeColor: "red",
        frameColor: "#0B5D1E",
      }),
    ).toEqual({ frameColor: "#0b5d1e" });
  });

  it("round-trips a two-color gradient with its angle", () => {
    const look = lookFromDesign({ fg: "#112233", gradient: "linear", fg2: "#0F766E", gradient_angle: 45 });
    expect(look).toMatchObject({ gradient: "linear", fg2: "#0f766e", gradientAngle: 45, gradientStops: null });
    expect(designFromLook(look)).toMatchObject({ gradient: "linear", fg2: "#0f766e", gradient_angle: 45 });
    expect(designFromLook({ ...look, gradient: "radial" })).not.toHaveProperty("gradient_angle");
    expect(designFromLook({ ...look, gradient: "" })).not.toHaveProperty("gradient");
  });

  it("keeps stored stops, shown as their first and last colors", () => {
    const stops = [
      { offset: 0, color: "#0b2a6f" },
      { offset: 40, color: "#6d108a" },
      { offset: 100, color: "#0a5c36" },
    ];
    const look = lookFromDesign({ fg: "#000000", gradient: "radial", gradient_stops: stops });
    expect(look).toMatchObject({ fg: "#000000", fg2: "#0a5c36", gradientStops: stops });
    const design = designFromLook(look);
    expect(design.gradient_stops).toEqual(stops);
    expect(design.fg).toBe("#000000"); // saved untouched, never the first stop
    expect(design).not.toHaveProperty("fg2");
  });

  it("drops malformed stops and unknown gradient kinds", () => {
    expect(lookFromDesign({ gradient: "conic", fg2: "#111111" }).gradient).toBe("");
    const look = lookFromDesign({ gradient: "linear", fg2: "#111111", gradient_stops: [{ offset: 0, color: "red" }] as never });
    expect(look.gradientStops).toBeNull();
    expect(lookFromDesign({ gradient: "linear", gradient_angle: 999 }).gradientAngle).toBe(0);
  });

  it("round-trips a transparent background and keeps the color for later", () => {
    const look = lookFromDesign({ fg: "#000000", bg: "transparent" });
    expect(look.transparent).toBe(true);
    expect(look.bg).toBe(DEFAULT_LOOK.bg);
    expect(designFromLook(look).bg).toBe("transparent");
    expect(designFromLook({ ...look, transparent: false, bg: "#fde68a" }).bg).toBe("#fde68a");
  });

  it("accepts gradient and transparency from the generator's hand-off", () => {
    expect(safeLook({ gradient: "radial", fg2: "#0F766E", gradientAngle: 30, transparent: true })).toEqual({
      gradient: "radial",
      fg2: "#0f766e",
      gradientAngle: 30,
      transparent: true,
    });
    expect(safeLook({ gradient: "spiral", gradientAngle: -1, transparent: "yes" })).toEqual({});
  });
});

describe("uploaded logos", () => {
  it("round-trips logo_upload_id and keeps it exclusive with an icon", () => {
    const look = lookFromDesign({ logo_upload_id: "00000000-0000-4000-8000-000000000001" });
    expect(look.logoUploadId).toBe("00000000-0000-4000-8000-000000000001");
    expect(designFromLook(look)).toMatchObject({ logo_upload_id: "00000000-0000-4000-8000-000000000001" });
    expect(designFromLook(look)).not.toHaveProperty("logo_icon");
    expect(designFromLook({ ...look, logoUploadId: "" })).not.toHaveProperty("logo_upload_id");
    // An icon chosen later wins over the uploaded logo.
    expect(designFromLook({ ...look, logoIcon: "star" })).not.toHaveProperty("logo_upload_id");
    expect(lookFromDesign({ logo_upload_id: "../x" }).logoUploadId).toBe("");
  });
});
