// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { DEFAULT_DESIGN, type QrDesign } from "@/lib/qr/types";
import { ColorFields } from "./color-fields";

const t = en.generator;
const d = t.design;
const seen: { design: QrDesign } = { design: DEFAULT_DESIGN };

function Harness({ start = DEFAULT_DESIGN }: { start?: QrDesign }) {
  const [design, setDesign] = useState<QrDesign>(start);
  return (
    <ColorFields
      t={t}
      value={design}
      onChange={(update) =>
        setDesign((cur) => {
          const next = { ...cur, ...update(cur) };
          seen.design = next;
          return next;
        })
      }
    />
  );
}

afterEach(cleanup);

describe("ColorFields", () => {
  it("starts solid, with no second color or angle", () => {
    render(<Harness />);
    expect(screen.getByRole("radio", { name: d.fillSolid })).toHaveProperty("checked", true);
    expect(screen.queryByLabelText(d.fg2)).toBeNull();
    expect(screen.queryByLabelText(new RegExp(d.gradientAngle))).toBeNull();
  });

  it("offers the end color and the angle for a linear gradient, only the color for radial", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: d.fillLinear }));
    expect(seen.design.gradient).toBe("linear");
    expect(screen.getByLabelText(d.fg2)).toBeTruthy();
    const angle = screen.getByLabelText(new RegExp(d.gradientAngle));
    fireEvent.change(angle, { target: { value: "90" } });
    expect(seen.design.gradientAngle).toBe(90);

    fireEvent.click(screen.getByRole("radio", { name: d.fillRadial }));
    expect(seen.design.gradient).toBe("radial");
    expect(screen.queryByLabelText(new RegExp(d.gradientAngle))).toBeNull();
  });

  it("replaces stored stops with two colors once a color is edited", () => {
    const stops = [
      { offset: 0, color: "#0b2a6f" },
      { offset: 50, color: "#6d108a" },
      { offset: 100, color: "#0a5c36" },
    ];
    render(<Harness start={{ ...DEFAULT_DESIGN, gradient: "linear", fg: "#000000", fg2: "#0a5c36", gradientStops: stops }} />);
    expect(screen.getByLabelText(d.fgStart)).toHaveProperty("value", "#0b2a6f");
    expect(screen.getByText(d.gradientStopsNote.replace("{count}", "3"))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(d.fg2), { target: { value: "#111111" } });
    expect(seen.design.gradientStops).toBeNull();
    expect(seen.design.fg2).toBe("#111111");
    expect(seen.design.fg).toBe("#0b2a6f"); // the start color shown, not the hidden stored fg
  });

  it("turns the background off and back on, keeping its color", () => {
    render(<Harness start={{ ...DEFAULT_DESIGN, bg: "#fde68a" }} />);
    fireEvent.click(screen.getByRole("checkbox", { name: d.transparent }));
    expect(seen.design.transparent).toBe(true);
    expect(screen.getByLabelText(d.bg)).toHaveProperty("disabled", true);
    expect(screen.getByText(d.transparentHelp)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: d.transparent }));
    expect(seen.design).toMatchObject({ transparent: false, bg: "#fde68a" });
  });
});
