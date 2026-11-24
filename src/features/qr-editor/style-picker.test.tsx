// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { DEFAULT_DESIGN, type QrDesign } from "@/lib/qr/types";
import { StylePicker } from "./style-picker";

const t = en.generator;
const names = t.design.styles;
const seen: { design: QrDesign } = { design: DEFAULT_DESIGN };

function Harness() {
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  return (
    <StylePicker
      t={t}
      design={design}
      onChange={(update) =>
        setDesign((d) => {
          const next = update(d);
          seen.design = next;
          return next;
        })
      }
    />
  );
}

afterEach(cleanup);

describe("StylePicker", () => {
  it("never leaves an eye in the pair the API refuses", () => {
    render(<Harness />);
    const group = (name: string) => within(screen.getByRole("group", { name }));
    fireEvent.click(group(t.design.eyeBall).getByRole("radio", { name: names.eyeBalls.diamond }));
    fireEvent.click(group(t.design.eyeFrame).getByRole("radio", { name: names.eyeFrames.pointed }));
    expect(seen.design.eyeFrames).toEqual(["pointed", "pointed", "pointed"]);
    expect(seen.design.eyeBalls).toEqual(["square", "square", "square"]);
  });

  it("sets one eye on its own and offers own colors", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: t.design.perEye }));
    const rings = screen.getAllByRole("combobox", { name: t.design.eyeFrame });
    fireEvent.change(rings[1], { target: { value: "circle" } });
    expect(seen.design.eyeFrames).toEqual(["square", "circle", "square"]);

    fireEvent.click(screen.getByRole("checkbox", { name: t.design.eyeColors }));
    expect(seen.design.eyeColor).toBe(seen.design.fg);
    expect(screen.getByText(t.design.eyeBallColor)).toBeTruthy();
  });
});
