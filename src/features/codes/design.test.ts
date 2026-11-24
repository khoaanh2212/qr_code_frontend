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
});
