// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { clearHandoff, readHandoff, saveHandoff } from "./handoff";

afterEach(() => sessionStorage.clear());

describe("generator hand-off", () => {
  it("is read until cleared", () => {
    saveHandoff({ url: "https://example.com", fg: "#112233", bg: "#ffffff" });
    expect(readHandoff()).toEqual({ url: "https://example.com", fg: "#112233", bg: "#ffffff", style: {} });
    expect(readHandoff()).not.toBeNull();
    clearHandoff();
    expect(readHandoff()).toBeNull();
  });

  it("drops what does not look like its own data", () => {
    sessionStorage.setItem("proofqr:dynamic-handoff", JSON.stringify({ url: "https://x.com", fg: "red;}", bg: 5 }));
    expect(readHandoff()).toEqual({ url: "https://x.com", fg: undefined, bg: undefined, style: {} });
    sessionStorage.setItem(
      "proofqr:dynamic-handoff",
      JSON.stringify({ url: "https://x.com", style: { module: "dots", eye: "<img>", frame: "box", frameText: 5 } }),
    );
    expect(readHandoff()?.style).toEqual({ module: "dots", frame: "box" });
    sessionStorage.setItem("proofqr:dynamic-handoff", "{not json");
    expect(readHandoff()).toBeNull();
  });
});
