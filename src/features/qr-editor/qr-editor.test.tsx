// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, publicApi } from "@/lib/api";
import type { MockInstance } from "vitest";
import type { QrCatalog } from "@/lib/qr/types";
import { QrEditor } from "./qr-editor";

const t = en.generator;

const catalog: QrCatalog = {
  formats: ["png", "svg"],
  types: [
    { type: "url", fields: [{ name: "url", required: true, max_length: 2000 }] },
    {
      type: "wifi",
      fields: [
        { name: "ssid", required: true, max_length: 32 },
        { name: "password", required: false, max_length: 64 },
        { name: "encryption", required: false, options: ["WPA", "WEP", "nopass"] },
        { name: "hidden", required: false, options: ["true", "false"] },
      ],
    },
  ],
};

let blob: MockInstance<typeof publicApi.requestBlob>;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(publicApi, "request").mockResolvedValue(catalog);
  blob = vi.spyOn(publicApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("QrEditor", () => {
  it("builds the form from the catalog and previews through a cacheable GET", async () => {
    render(<QrEditor t={t} />);
    const input = await screen.findByLabelText(/Website address/);
    fireEvent.change(input, { target: { value: "https://example.com" } });
    await settle();

    expect(blob).toHaveBeenCalledTimes(1);
    const [path, opts] = blob.mock.calls[0] as [string, { method?: string }];
    expect(path).toMatch(/^\/v1\/qr\/render\?type=url&/);
    expect(opts.method).toBeUndefined();
    expect(await screen.findByAltText(t.preview.alt)).toBeTruthy();
  });

  it("does not call the API until required content is there", async () => {
    render(<QrEditor t={t} />);
    await screen.findByLabelText(/Website address/);
    await settle();
    expect(blob).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe(t.preview.empty);
  });

  it("shows the API's validation error on the field, translated", async () => {
    blob.mockRejectedValue(new ApiError(422, "validation_error", "url must start with http", "url"));
    render(<QrEditor t={t} />);
    const input = await screen.findByLabelText(/Website address/);
    fireEvent.change(input, { target: { value: "ftp://x" } });
    await settle();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByText(t.validation.invalid).length).toBeGreaterThan(0);
    expect(screen.queryByText(/must start with/)).toBeNull();
  });

  it("posts Wi-Fi content and hides the password of an open network", async () => {
    render(<QrEditor t={t} />);
    fireEvent.click(await screen.findByLabelText("Wi-Fi"));
    fireEvent.change(screen.getByLabelText(/Network name/), { target: { value: "Cafe" } });
    await settle();
    expect(blob).not.toHaveBeenCalled(); // WPA without a password

    fireEvent.change(screen.getByLabelText("Security"), { target: { value: "nopass" } });
    expect(screen.queryByLabelText(/Password/)).toBeNull();
    await settle();
    const [path, opts] = blob.mock.calls[0] as [string, { method?: string; body?: { data: unknown } }];
    expect(path).toBe("/v1/qr/render");
    expect(opts.method).toBe("POST");
    expect(opts.body?.data).toEqual({ ssid: "Cafe", encryption: "nopass" });
  });

  it("offers a retry when the catalog cannot be loaded", async () => {
    vi.mocked(publicApi.request).mockRejectedValueOnce(new ApiError(0, "network_error", "down"));
    render(<QrEditor t={t} />);
    expect(await screen.findByText(t.errors.loadTypes)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.errors.retry }));
    expect(await screen.findByLabelText(/Website address/)).toBeTruthy();
  });
});
