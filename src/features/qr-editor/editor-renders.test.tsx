// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { publicApi } from "@/lib/api";
import type { QrCatalog } from "@/lib/qr/types";
import { QrEditor } from "./qr-editor";

// Typing the content must not redraw the design controls (the style picker draws dozens of
// SVG thumbnails): only the content fields and the preview depend on it.
const renders = vi.hoisted(() => ({ stylePicker: 0, typePicker: 0 }));

vi.mock("./style-picker", async (importOriginal) => {
  const real = await importOriginal<typeof import("./style-picker")>();
  return {
    ...real,
    StylePicker: (props: Parameters<typeof real.StylePicker>[0]) => {
      renders.stylePicker++;
      return real.StylePicker(props);
    },
  };
});
vi.mock("./type-picker", async (importOriginal) => {
  const real = await importOriginal<typeof import("./type-picker")>();
  return {
    ...real,
    TypePicker: (props: Parameters<typeof real.TypePicker>[0]) => {
      renders.typePicker++;
      return real.TypePicker(props);
    },
  };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/url-qr-code" }));

const catalog: QrCatalog = {
  formats: ["png", "svg"],
  types: [{ type: "url", fields: [{ name: "url", required: true, max_length: 2000 }] }],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(publicApi, "request").mockResolvedValue(catalog);
  vi.spyOn(publicApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("QrEditor rendering", () => {
  it("does not redraw the design controls while the content is typed", async () => {
    render(<QrEditor t={en.generator} locale="en" />);
    const input = await screen.findByLabelText(/Website address/);
    // The style picker draws on the Shape tab (the design options sit in tabs).
    fireEvent.click(screen.getByRole("tab", { name: en.generator.designTabs.shape }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const before = { ...renders };
    for (const value of ["h", "ht", "htt", "http", "https://example.com"]) {
      fireEvent.change(input, { target: { value } });
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500); // the preview arrives too
    });
    expect(renders.stylePicker - before.stylePicker).toBe(0);
    expect(renders.typePicker - before.typePicker).toBe(0);

    // Positive control: a design change still reaches the picker.
    fireEvent.click(screen.getAllByLabelText(en.generator.design.styles.modules.dots)[0]);
    expect(renders.stylePicker - before.stylePicker).toBeGreaterThan(0);
  });
});
