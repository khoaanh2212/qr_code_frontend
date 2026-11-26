// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { DEFAULT_DESIGN, type QrDesign } from "@/lib/qr/types";
import { PreviewPanel } from "./preview-panel";

const t = en.generator;
const ready = { src: null, pending: false, error: null };

function panel(design: Pick<QrDesign, "transparent" | "logo">) {
  return render(
    <PreviewPanel
      t={t}
      preview={ready}
      blocker={null}
      contentKey="k"
      filename="qr-code"
      design={design}
      buildDownload={() => ({ method: "GET", path: "/v1/qr/render" })}
    />,
  );
}

const button = (format: string) => screen.getByRole("button", { name: t.download.button.replace("{format}", format) });

afterEach(cleanup);

describe("PreviewPanel formats", () => {
  it("offers EPS, with a note on what it is for", () => {
    panel(DEFAULT_DESIGN);
    fireEvent.click(screen.getByRole("radio", { name: "eps" }));
    expect(screen.getByText(t.download.epsNote)).toBeTruthy();
    expect(button("EPS")).toHaveProperty("disabled", false);
  });

  it("says why JPG is out for a transparent background and blocks the download", () => {
    panel({ ...DEFAULT_DESIGN, transparent: true });
    fireEvent.click(screen.getByRole("radio", { name: "jpg" }));
    expect(screen.getByText(t.download.jpgTransparent)).toBeTruthy();
    expect(button("JPG")).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: "png" }));
    expect(button("PNG")).toHaveProperty("disabled", false);
  });

  it("says why EPS is out with an uploaded logo", () => {
    panel({ ...DEFAULT_DESIGN, logo: { base64: "AAAA", name: "logo.png", id: "1" } });
    fireEvent.click(screen.getByRole("radio", { name: "eps" }));
    expect(screen.getByText(t.download.epsLogo)).toBeTruthy();
    expect(button("EPS")).toHaveProperty("disabled", true);
  });
});
