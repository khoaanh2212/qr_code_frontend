// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, publicApi, sessionApi } from "@/lib/api";
import type { MockInstance } from "vitest";
import type { QrCatalog } from "@/lib/qr/types";
import { QrEditor } from "./qr-editor";

vi.mock("next/navigation", () => ({ usePathname: () => "/vi/url-qr-code" }));

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

/** The Wi-Fi type card (an icon card is also labelled "Wi-Fi"). */
const wifiType = async () => within(await screen.findByRole("group", { name: t.typesLabel })).getByLabelText(t.types.wifi);

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("QrEditor", () => {
  it("builds the form from the catalog and previews through a cacheable GET", async () => {
    render(<QrEditor t={t} locale="en" />);
    const input = await screen.findByLabelText(/Website address/);
    fireEvent.change(input, { target: { value: "https://example.com" } });
    await settle();

    expect(blob).toHaveBeenCalledTimes(1);
    const [path, opts] = blob.mock.calls[0] as [string, { method?: string }];
    expect(path).toMatch(/^\/v1\/qr\/render\?type=url&/);
    expect(opts.method).toBeUndefined();
    expect(await screen.findByAltText(t.preview.alt)).toBeTruthy();
  });

  it("offers a dynamic code for a valid website address and hands it over", async () => {
    render(<QrEditor t={t} locale="vi" />);
    const input = await screen.findByLabelText(/Website address/);
    expect(screen.queryByRole("link", { name: t.makeDynamic })).toBeNull();
    fireEvent.change(input, { target: { value: "https://example.com/menu" } });
    const link = screen.getByRole("link", { name: t.makeDynamic });
    expect(link.getAttribute("href")).toBe("/vi/app/codes/new");
    fireEvent.click(link);
    expect(JSON.parse(sessionStorage.getItem("proofqr:dynamic-handoff") ?? "{}")).toEqual({
      url: "https://example.com/menu",
      fg: "#000000",
      bg: "#ffffff",
      style: {
        module: "square",
        eyeFrames: ["square", "square", "square"],
        eyeBalls: ["square", "square", "square"],
        eyeColor: "",
        eyeBallColor: "",
        frame: "none",
        frameText: "",
        frameColor: "",
        logoIcon: "",
      },
    });
    sessionStorage.clear();
  });

  it("renders an own caption through the session and asks to sign in on 401", async () => {
    const signedIn = vi
      .spyOn(sessionApi, "requestBlob")
      .mockRejectedValue(new ApiError(401, "unauthenticated", "Sign in first."));
    render(<QrEditor t={t} locale="vi" />);
    fireEvent.change(await screen.findByLabelText(/Website address/), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("radio", { name: t.design.styles.frames.box }));
    fireEvent.change(screen.getByRole("textbox", { name: t.design.frameText }), { target: { value: "Thực đơn" } });
    await settle();

    expect(signedIn).toHaveBeenCalledWith("/v1/me/qr/render", expect.objectContaining({ method: "POST" }));
    expect(screen.getByText(t.design.frameTextSignIn)).toBeTruthy();
    const link = screen.getByRole("link", { name: t.design.frameTextSignInLink });
    expect(link.getAttribute("href")).toBe("/vi/login?return_to=%2Fvi%2Furl-qr-code");
  });

  it("does not call the API until required content is there", async () => {
    render(<QrEditor t={t} locale="en" />);
    await screen.findByLabelText(/Website address/);
    await settle();
    expect(blob).not.toHaveBeenCalled();
    expect(screen.getByText(t.preview.empty)).toBeTruthy();
  });

  it("blocks the download and hides the code when the API refuses the content", async () => {
    blob.mockRejectedValue(new ApiError(422, "validation_error", "url must include a host", "url"));
    render(<QrEditor t={t} locale="en" />);
    const input = await screen.findByLabelText(/Website address/);
    fireEvent.change(input, { target: { value: "https://example.com" } });
    await settle();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText(/must include/)).toBeNull();
    expect(screen.getByText(/Fix “Website address”/)).toBeTruthy();
    expect(screen.queryByAltText(t.preview.alt)).toBeNull();
    expect((screen.getByRole("button", { name: /Download/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the download available when only the preview hit a network error", async () => {
    blob.mockRejectedValueOnce(new ApiError(0, "network_error", "down"));
    render(<QrEditor t={t} locale="en" />);
    const input = await screen.findByLabelText(/Website address/);
    fireEvent.change(input, { target: { value: "https://example.com" } });
    await settle();
    expect(screen.getByText(t.errors.network)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Download/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("explains a bad URL at the field without calling the API, and adds https:// to a bare domain", async () => {
    render(<QrEditor t={t} locale="en" />);
    const input = (await screen.findByLabelText(/Website address/)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ftp://example.com" } });
    fireEvent.blur(input);
    await settle();
    expect(blob).not.toHaveBeenCalled();
    expect(screen.getByText(t.validation.url)).toBeTruthy();

    fireEvent.change(input, { target: { value: "example.com" } });
    fireEvent.blur(input);
    expect(input.value).toBe("https://example.com");
    await settle();
    expect(blob).toHaveBeenCalledTimes(1);
  });

  it("checks the WPA password length before calling the API", async () => {
    render(<QrEditor t={t} locale="en" />);
    fireEvent.click(await wifiType());
    fireEvent.change(screen.getByLabelText(/Network name/), { target: { value: "Office" } });
    const pw = screen.getByLabelText(/Password/);
    fireEvent.change(pw, { target: { value: "short" } });
    fireEvent.blur(pw);
    await settle();
    expect(blob).not.toHaveBeenCalled();
    expect(screen.getByText(t.validation.wpa)).toBeTruthy();
  });

  it("posts Wi-Fi content and hides the password of an open network", async () => {
    render(<QrEditor t={t} locale="en" />);
    fireEvent.click(await wifiType());
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

  it("opens on the type a per-type page asks for", async () => {
    render(<QrEditor t={t} locale="en" initialType="wifi" />);
    expect(await screen.findByLabelText(/Network name/)).toBeTruthy();
    expect(((await wifiType()) as HTMLInputElement).checked).toBe(true);
    // The other types stay one click away.
    fireEvent.click(screen.getByLabelText("Website"));
    expect(screen.getByLabelText(/Website address/)).toBeTruthy();
  });

  it("falls back to the first type when the API does not offer the requested one", async () => {
    render(<QrEditor t={t} locale="en" initialType="sms" />);
    expect(await screen.findByLabelText(/Website address/)).toBeTruthy();
  });

  it("offers a retry when the catalog cannot be loaded", async () => {
    vi.mocked(publicApi.request).mockRejectedValueOnce(new ApiError(0, "network_error", "down"));
    render(<QrEditor t={t} locale="en" />);
    expect(await screen.findByText(t.errors.loadTypes)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.errors.retry }));
    expect(await screen.findByLabelText(/Website address/)).toBeTruthy();
  });
});
