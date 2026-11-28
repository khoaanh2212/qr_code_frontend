// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "@/i18n/config";
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

  it("tracks a website's scans through a dynamic code: the switch trades the download for it", async () => {
    render(<QrEditor t={t} locale="vi" />);
    const input = await screen.findByLabelText(/Website address/);
    fireEvent.change(input, { target: { value: "https://example.com/menu" } });
    await settle();
    const track = screen.getByRole("switch", { name: t.trackScans });
    expect(track.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("button", { name: /Download/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: t.trackScansContinue })).toBeNull();

    fireEvent.click(track);
    expect(track.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
    const link = screen.getByRole("link", { name: t.trackScansContinue });
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
        gradient: "",
        fg2: "#0f766e",
        gradientAngle: 0,
        transparent: false,
        logoIcon: "",
      },
    });
    sessionStorage.clear();

    fireEvent.click(track);
    expect(screen.getByRole("button", { name: /Download/ })).toBeTruthy();
  });

  it("starts every type with scan tracking off, and toggles from its label too", async () => {
    render(<QrEditor t={t} locale="en" />);
    await screen.findByLabelText(/Website address/);
    fireEvent.click(screen.getByText(t.trackScans));
    expect(screen.getByRole("switch", { name: t.trackScans }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(await wifiType());
    fireEvent.click(within(screen.getByRole("group", { name: t.typesLabel })).getByLabelText(t.types.url));
    expect(screen.getByRole("switch", { name: t.trackScans }).getAttribute("aria-checked")).toBe("false");
  });

  it("offers no scan tracking for types a dynamic code cannot lead to", async () => {
    render(<QrEditor t={t} locale="en" />);
    await screen.findByLabelText(/Website address/);
    fireEvent.click(await wifiType());
    expect(screen.queryByRole("switch", { name: t.trackScans })).toBeNull();
  });

  it("tracks a social profile's scans as its link", async () => {
    vi.mocked(publicApi.request).mockResolvedValue({
      ...catalog,
      types: [
        ...catalog.types,
        {
          type: "social",
          fields: [
            { name: "network", required: true, options: ["instagram", "tiktok"] },
            { name: "username", required: true },
            { name: "text", required: false },
          ],
        },
      ],
    });
    render(<QrEditor t={t} locale="en" initialType="social" />);
    fireEvent.change(await screen.findByLabelText(new RegExp(t.fields.social.username.label)), { target: { value: "@proofqr" } });
    fireEvent.click(screen.getByRole("switch", { name: t.trackScans }));
    fireEvent.click(screen.getByRole("link", { name: t.trackScansContinue }));
    expect(JSON.parse(sessionStorage.getItem("proofqr:dynamic-handoff") ?? "{}").url).toBe("https://www.instagram.com/proofqr/");
    sessionStorage.clear();
  });

  describe("hosted page tabs", () => {
    const p = en.pages;
    const tabs = async () => within(await screen.findByRole("group", { name: t.typesLabel }));

    it("offers the hosted page types after the static ones, each showing its sample and leading to a free account", async () => {
      render(<QrEditor t={t} pageTypes={p.types} locale="vi" />);
      fireEvent.click((await tabs()).getByLabelText(p.types.pdf.name));
      expect(screen.queryByLabelText(/Website address/)).toBeNull();
      expect(screen.getByRole("heading", { name: p.types.pdf.name, level: 2 })).toBeTruthy();
      const frame = screen.getByTitle(format(t.pagePromo.sampleFrame, { type: p.types.pdf.name })) as HTMLIFrameElement;
      expect(frame.src).toMatch(/\/v1\/page-types\/pdf\/sample\?lang=vi$/);
      expect(frame.getAttribute("sandbox")).toBe("");
      expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
      const create = screen.getByRole("link", { name: t.pagePromo.create });
      expect(create.getAttribute("href")).toBe("/vi/app/codes/new");
      fireEvent.click(create);
      expect(JSON.parse(sessionStorage.getItem("proofqr:dynamic-handoff") ?? "{}")).toEqual({ url: "", opens: "pdf" });
      sessionStorage.clear();
      // Back to a static type: its fields return.
      fireEvent.click((await tabs()).getByLabelText(t.types.url));
      expect(await screen.findByLabelText(/Website address/)).toBeTruthy();
    });

    it("tells screen readers a page tab is a hosted page", async () => {
      render(<QrEditor t={t} pageTypes={p.types} locale="en" />);
      const pdf = (await tabs()).getByLabelText(p.types.pdf.name);
      const said = (pdf.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
      expect(said).toContain(t.pagesGroup);
    });

    it("has no page tabs without the pages' messages", async () => {
      render(<QrEditor t={t} locale="en" />);
      expect((await tabs()).queryByLabelText(p.types.pdf.name)).toBeNull();
    });
  });

  it("renders an own caption through the session and asks to sign in on 401", async () => {
    const signedIn = vi
      .spyOn(sessionApi, "requestBlob")
      .mockRejectedValue(new ApiError(401, "unauthenticated", "Sign in first."));
    render(<QrEditor t={t} locale="vi" />);
    fireEvent.change(await screen.findByLabelText(/Website address/), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("tab", { name: t.designTabs.frame }));
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
