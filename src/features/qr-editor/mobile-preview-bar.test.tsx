// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { MobilePreviewBar } from "./mobile-preview-bar";

let notify: (visible: boolean) => void = () => {};

class FakeObserver {
  constructor(cb: IntersectionObserverCallback) {
    notify = (visible) => cb([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  observe() {}
  disconnect() {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function setup() {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const target = document.createElement("section");
  target.id = "qr-preview";
  target.innerHTML = '<button data-qr-download>Download</button>';
  target.scrollIntoView = vi.fn();
  document.body.append(target);
  render(<MobilePreviewBar t={en.generator} src="blob:x" targetId="qr-preview" />);
  return target;
}

describe("MobilePreviewBar", () => {
  it("appears only while the preview is off screen", () => {
    setup();
    expect(screen.queryByRole("button", { name: en.generator.preview.jump })).toBeNull();
    act(() => notify(false));
    expect(screen.getByRole("button", { name: en.generator.preview.jump })).toBeTruthy();
    act(() => notify(true));
    expect(screen.queryByRole("button", { name: en.generator.preview.jump })).toBeNull();
  });

  it("brings the preview into view and focuses its download button", () => {
    const target = setup();
    act(() => notify(false));
    fireEvent.click(screen.getByRole("button", { name: en.generator.preview.jump }));
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    expect(document.activeElement).toBe(target.querySelector("[data-qr-download]"));
  });
});
