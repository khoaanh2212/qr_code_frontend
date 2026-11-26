// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { DEFAULT_DESIGN, type QrDesign } from "@/lib/qr/types";
import { DesignPanel } from "./design-panel";

const t = en.generator;
const tabs = t.designTabs;

function Harness({ error }: { error?: { field: string; message: string } }) {
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  return <DesignPanel t={t} design={design} onChange={setDesign} contrastOk error={error} />;
}

afterEach(cleanup);

// The design options sit in tabs, one group at a time, so the generator stays about one screen
// tall and the home page has room for the content below it.
describe("DesignPanel tabs", () => {
  it("shows one group of options at a time, colors first", () => {
    render(<Harness />);
    const list = screen.getByRole("tablist", { name: tabs.label });
    const names = [...list.querySelectorAll('[role="tab"]')].map((el) => el.textContent);
    expect(names).toEqual([tabs.colors, tabs.shape, tabs.frame, tabs.logo, tabs.more]);
    expect(screen.getByRole("tab", { name: tabs.colors }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: tabs.colors })).toBeTruthy();
    // Other groups are not drawn until their tab is chosen.
    expect(screen.queryByRole("group", { name: t.design.module })).toBeNull();
    expect(screen.queryByRole("group", { name: t.design.frame })).toBeNull();
    expect(screen.queryByLabelText(t.design.ecc)).toBeNull();
  });

  it("switches groups by click and by arrow keys, keeping one tab in the tab order", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: tabs.shape }));
    expect(screen.getByRole("group", { name: t.design.module })).toBeTruthy();
    expect(screen.queryByRole("group", { name: t.design.fill })).toBeNull();

    const shape = screen.getByRole("tab", { name: tabs.shape });
    fireEvent.keyDown(shape, { key: "ArrowRight" });
    const frame = screen.getByRole("tab", { name: tabs.frame });
    expect(frame.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(frame);
    expect(screen.getByRole("group", { name: t.design.frame })).toBeTruthy();

    fireEvent.keyDown(frame, { key: "End" });
    expect(screen.getByLabelText(t.design.ecc)).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("tab", { name: tabs.more }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: tabs.colors }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: tabs.colors }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: tabs.more }).getAttribute("aria-selected")).toBe("true");

    const tabIndexes = screen.getAllByRole("tab").map((el) => el.getAttribute("tabindex"));
    expect(tabIndexes.filter((x) => x === "0")).toHaveLength(1);
  });

  it("opens on the group of a field already refused when it appears", () => {
    render(<Harness error={{ field: "logo", message: t.design.logoType }} />);
    expect(screen.getByRole("tab", { name: tabs.logo }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens the group of a field the server refused", () => {
    const { rerender } = render(<Harness />);
    rerender(<Harness error={{ field: "logo", message: t.design.logoType }} />);
    expect(screen.getByRole("tab", { name: tabs.logo }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(t.design.logoType)).toBeTruthy();
    rerender(<Harness error={{ field: "frame_text", message: t.design.frameTextInvalid }} />);
    expect(screen.getByRole("tab", { name: tabs.frame }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens a refused field's tab once, not again while the preview reloads", () => {
    const err = { field: "frame_text", message: t.design.frameTextSignIn };
    const { rerender } = render(<Harness error={err} />);
    expect(screen.getByRole("tab", { name: tabs.frame }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: tabs.colors }));
    // Each edit reloads the preview: the error goes away while it loads, then comes back.
    rerender(<Harness error={undefined} />);
    rerender(<Harness error={{ ...err }} />);
    expect(screen.getByRole("tab", { name: tabs.colors }).getAttribute("aria-selected")).toBe("true");
  });

  it("leaves arrow keys with a modifier to the browser", () => {
    render(<Harness />);
    const colors = screen.getByRole("tab", { name: tabs.colors });
    fireEvent.keyDown(colors, { key: "ArrowRight", altKey: true });
    fireEvent.keyDown(colors, { key: "ArrowRight", metaKey: true });
    expect(colors.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps 'each eye separately' ticked across tab switches", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: tabs.shape }));
    fireEvent.click(screen.getByRole("checkbox", { name: t.design.perEye }));
    fireEvent.click(screen.getByRole("tab", { name: tabs.colors }));
    fireEvent.click(screen.getByRole("tab", { name: tabs.shape }));
    expect((screen.getByRole("checkbox", { name: t.design.perEye }) as HTMLInputElement).checked).toBe(true);
  });
});
