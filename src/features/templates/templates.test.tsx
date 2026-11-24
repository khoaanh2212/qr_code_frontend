// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, publicApi, sessionApi } from "@/lib/api";
import type { DesignTemplate } from "@/lib/api/types";
import { DEFAULT_DESIGN } from "@/lib/qr/types";
import { applyTemplate, templateFromDesign } from "./convert";
import { GeneratorTemplates } from "./generator-templates";
import { TemplateBar } from "./template-bar";

vi.mock("next/navigation", () => ({ usePathname: () => "/vi" }));

const t = en.templates;
const tpl: DesignTemplate = {
  id: "t1",
  name: "Café",
  design: { fg: "#1a237e", module: "dots", eye_frame: "leaf", frame: "cup", frame_text: "Menu", logo_icon: "heart", ecc: "Q", margin: 3 },
  created_at: "2026-11-24T10:00:00Z",
  updated_at: "2026-11-24T10:00:00Z",
};

let request: MockInstance<typeof sessionApi.request>;

beforeEach(() => {
  request = vi.spyOn(sessionApi, "request").mockImplementation(async (path, opts) => {
    if (path === "/v1/workspaces/w1/design-templates" && !opts?.method) return { templates: [tpl] };
    if (path === "/v1/workspaces/w1/design-templates" && opts?.method === "POST")
      return { template: { ...tpl, id: "t2", name: "Mine" } };
    throw new Error(`unexpected ${path}`);
  });
  vi.spyOn(publicApi, "requestBlob").mockResolvedValue(new Blob(["png"]));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("template conversion", () => {
  it("applies a template's look, error correction and margin", () => {
    const d = applyTemplate({ ...DEFAULT_DESIGN, logo: { name: "l.png", id: "l", base64: "AA" } }, tpl.design);
    expect(d).toMatchObject({ fg: "#1a237e", module: "dots", frame: "cup", frameText: "Menu", logoIcon: "heart", ecc: "Q", margin: 3 });
    expect(d.eyeFrames).toEqual(["leaf", "leaf", "leaf"]);
    expect(d.logo).toBeUndefined(); // the template's icon replaces the uploaded logo
  });

  it("saves the generator's design without an uploaded logo", () => {
    const out = templateFromDesign({ ...DEFAULT_DESIGN, logoIcon: "star", logo: { name: "l.png", id: "l", base64: "AA" }, ecc: "H" });
    expect(out).not.toHaveProperty("logo_icon");
    expect(out).toMatchObject({ fg: "#000000", ecc: "H", margin: 4 });
  });
});

describe("TemplateBar", () => {
  it("applies a picked template and saves the current design", async () => {
    const onApply = vi.fn();
    render(<TemplateBar t={t} workspaceId="w1" currentDesign={() => ({ fg: "#112233" })} onApply={onApply} />);
    const select = (await screen.findByRole("option", { name: "Café" })).closest("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "t1" } });
    expect(onApply).toHaveBeenCalledWith(tpl.design);
    expect(screen.getByText(t.applied)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t.save }));
    fireEvent.change(screen.getByRole("textbox", { name: t.name }), { target: { value: "Mine" } });
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.saveConfirm })));
    expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/design-templates", {
      method: "POST",
      body: { name: "Mine", design: { fg: "#112233" } },
    });
    expect(screen.getByText(t.saved)).toBeTruthy();
    expect(screen.getByRole("option", { name: "Mine" })).toBeTruthy();
  });

  it("says why a save was refused", async () => {
    request.mockImplementation(async (_path, opts) => {
      if (opts?.method === "POST") throw new ApiError(409, "template_name_taken", "taken");
      return { templates: [] };
    });
    render(<TemplateBar t={t} workspaceId="w1" currentDesign={() => ({})} onApply={vi.fn()} />);
    expect(await screen.findByRole("option", { name: t.none })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.save }));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.saveConfirm })));
    expect(screen.getByText(t.errors.nameRequired)).toBeTruthy(); // empty name: no request
    fireEvent.change(screen.getByRole("textbox", { name: t.name }), { target: { value: "Café" } });
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.saveConfirm })));
    expect(screen.getByText(t.errors.nameTaken)).toBeTruthy();
  });
});

describe("GeneratorTemplates", () => {
  it("asks for nothing until opened, then offers sign-in when signed out", async () => {
    request.mockRejectedValue(new ApiError(401, "unauthenticated", "Please log in."));
    render(<GeneratorTemplates t={t} locale="vi" currentDesign={() => ({})} onApply={vi.fn()} />);
    expect(request).not.toHaveBeenCalled();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.open })));
    expect(request).toHaveBeenCalledWith("/v1/me", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByRole("link", { name: t.signInLink }).getAttribute("href")).toBe("/vi/login?return_to=%2Fvi");
  });
});
