// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RequireSession } from "@/features/auth/require-session";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import type { CodeStats, DynamicCode } from "@/lib/api/types";
import { CodeDetail } from "./code-detail";
import { CodeForm } from "./code-form";
import { CodesList } from "./codes-list";
import { saveHandoff } from "./handoff";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "c1" }),
}));

const t = en.codes;
const auth = en.auth;
const user = {
  id: "u1",
  email: "an@example.com",
  display_name: "An",
  role: "user" as const,
  email_verified: true,
  has_password: true,
  created_at: "2026-11-01T10:00:00Z",
};
const me = { user, workspaces: [{ id: "w1", name: "Personal", personal: true, role: "owner" }] };
const captcha = { siteKey: null, nonce: null, devToken: "dev-token" };
const code: DynamicCode = {
  id: "c1",
  short_code: "Ab3dE5gH",
  short_url: "http://localhost:8180/Ab3dE5gH",
  name: "Menu",
  target_url: "https://example.com/menu",
  design: { fg: "#000000", bg: "#ffffff" },
  status: "active",
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
};
const days = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-11-${String(i + 1).padStart(2, "0")}`,
  scans: i === 29 ? 3 : 0,
  unique_scans: i === 29 ? 2 : 0,
}));
const stats: CodeStats = {
  from: "2026-11-01",
  to: "2026-11-30",
  scans: 3,
  daily: days,
  countries: [{ value: "VN", scans: 2 }], // the third scan has no known country
  devices: [{ value: "mobile", scans: 3 }],
  os: [],
  browsers: [],
};

let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  push.mockReset();
  request = vi.spyOn(sessionApi, "request").mockImplementation(async (path) => {
    if (path === "/v1/me") return me;
    throw new Error(`unexpected ${path}`);
  });
  requestVoid = vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
  vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  assign = vi.fn();
  vi.stubGlobal("location", { assign, replace: vi.fn(), pathname: "/app", search: "" });
  URL.createObjectURL = vi.fn(() => "blob:qr");
  URL.revokeObjectURL = vi.fn();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const withSession = (ui: React.ReactNode) => render(<RequireSession messages={en.session}>{ui}</RequireSession>);
const click = (name: string | RegExp) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));
// By role: the "Destination" section is labelled like its field.
const field = (name: string | RegExp) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const type = (name: string | RegExp, value: string) => fireEvent.change(field(name), { target: { value } });

describe("CodesList", () => {
  it("invites to create the first code when there are none", async () => {
    request.mockImplementation(async (path) => (path === "/v1/me" ? me : { codes: [], next_cursor: null }));
    withSession(<CodesList t={t} templatesLabel="Manage templates" locale="en" />);
    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.newCode }).getAttribute("href")).toBe("/app/codes/new");
  });

  it("lists the personal workspace's codes and loads more", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      if (path === "/v1/workspaces/w1/codes?limit=50") return { codes: [code], next_cursor: "n1" };
      if (path === "/v1/workspaces/w1/codes?limit=50&cursor=n1")
        return { codes: [{ ...code, id: "c2", name: "", status: "paused" }], next_cursor: null };
      throw new Error(`unexpected ${path}`);
    });
    withSession(<CodesList t={t} templatesLabel="Manage templates" locale="vi" />);
    const link = await screen.findByRole("link", { name: /Menu/ });
    expect(link.getAttribute("href")).toBe("/vi/app/codes/c1");
    expect(within(link).getByText("localhost:8180/Ab3dE5gH")).toBeTruthy();
    expect(within(link).getByText("→ example.com")).toBeTruthy();
    await click(t.loadMore);
    expect(screen.getByText(t.untitled)).toBeTruthy();
    expect(screen.getByText(t.status.paused)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.loadMore })).toBeNull();
  });

  it("offers a retry when the list fails to load", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      throw new ApiError(503, "busy", "busy");
    });
    withSession(<CodesList t={t} templatesLabel="Manage templates" locale="en" />);
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.retry })).toBeTruthy();
  });
});

describe("CodeForm", () => {
  const renderForm = () =>
    withSession(<CodeForm t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" captcha={captcha} />);

  it("creates a code with the handed-over destination and opens it", async () => {
    saveHandoff({ url: "https://example.com/promo", fg: "#112233", bg: "#ffffff" });
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return me;
      if (path === "/v1/workspaces/w1/codes" && opts?.method === "POST") return { code };
      throw new Error(`unexpected ${path}`);
    });
    renderForm();
    const target = (await screen.findByRole("textbox", { name: new RegExp(t.target) })) as HTMLInputElement;
    await waitFor(() => expect(target.value).toBe("https://example.com/promo"));
    expect(sessionStorage.length).toBe(0); // read once
    type(t.name, "  Promo  ");
    await click(t.create);
    expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/codes", {
      method: "POST",
      body: {
        name: "Promo",
        target_url: "https://example.com/promo",
        design: { fg: "#112233", bg: "#ffffff" },
        captcha_token: "dev-token",
      },
    });
    expect(push).toHaveBeenCalledWith("/app/codes/c1");
  });

  it("adds https:// and refuses what is not a web address without calling the API", async () => {
    renderForm();
    const target = (await screen.findByRole("textbox", { name: new RegExp(t.target) })) as HTMLInputElement;
    type(new RegExp(t.target), "mailto:a@example.com");
    await click(t.create);
    expect(screen.getByText(t.errors.targetUrl)).toBeTruthy();
    expect(request).not.toHaveBeenCalledWith("/v1/workspaces/w1/codes", expect.anything());

    type(new RegExp(t.target), "example.com");
    fireEvent.blur(target);
    expect(target.value).toBe("https://example.com");
  });

  it("shows the API's reason for refusing, such as an unverified address", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      throw new ApiError(403, "email_not_verified", "verify");
    });
    renderForm();
    await screen.findByRole("textbox", { name: new RegExp(t.target) });
    type(new RegExp(t.target), "https://example.com");
    await click(t.create);
    // Among the alerts (the templates bar has its own), the form's says why.
    expect(screen.getAllByRole("alert").some((a) => a.textContent === t.errors.verifyFirst)).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("CodeDetail", () => {
  const detailApi = (overrides: Partial<DynamicCode> = {}) =>
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return me;
      if (path === "/v1/workspaces/w1/codes/c1" && !opts?.method) return { code: { ...code, ...overrides } };
      if (path === "/v1/workspaces/w1/codes/c1/stats") return stats;
      if (path === "/v1/workspaces/w1/codes/c1" && opts?.method === "PATCH")
        return { code: { ...code, ...overrides, ...(opts.body as object) } };
      throw new Error(`unexpected ${path}`);
    });

  it("shows the short link, scans, top countries and devices", async () => {
    detailApi();
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    expect(await screen.findByRole("heading", { name: "Menu", level: 1 })).toBeTruthy();
    expect(screen.getByText(code.short_url)).toBeTruthy();
    expect(await screen.findByText("3 scans")).toBeTruthy();
    expect(screen.getByText("Vietnam")).toBeTruthy();
    expect(screen.getByText(t.unknown)).toBeTruthy();
    // Scoped: "Phone" is also the name of a frame in the Design section.
    expect(within(screen.getByRole("region", { name: t.scansTitle })).getByText(t.deviceNames.mobile)).toBeTruthy();
    // The numbers behind the bars, as a table.
    await click(t.tableToggle);
    expect(screen.getByRole("row", { name: "Nov 30 3 2" })).toBeTruthy();
  });

  it("changes the destination and pauses the code", async () => {
    detailApi();
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
    type(new RegExp(t.target), "https://example.com/new");
    await act(async () => void fireEvent.click(screen.getAllByRole("button", { name: t.save })[0]));
    expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", {
      method: "PATCH",
      body: { target_url: "https://example.com/new" },
    });
    expect(screen.getByText(t.saved)).toBeTruthy();

    await click(t.pause);
    expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", { method: "PATCH", body: { status: "paused" } });
    expect(screen.getByRole("button", { name: t.resume })).toBeTruthy();
  });

  it("restyles the code and draws its image again", async () => {
    detailApi();
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
    const images = vi.mocked(sessionApi.requestBlob).mock.calls.length;
    await act(async () => void fireEvent.click(screen.getByRole("radio", { name: en.generator.design.styles.modules.dots })));
    await act(async () => void fireEvent.click(screen.getByRole("radio", { name: en.generator.design.styles.frames["label-bottom"] })));
    expect(field(en.generator.design.frameText).value).toBe(en.generator.design.frameTextDefault);
    const save = screen.getAllByRole("button", { name: t.save })[1]; // Destination, then Design
    await act(async () => void fireEvent.click(save));
    expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", {
      method: "PATCH",
      body: { design: { fg: "#000000", bg: "#ffffff", module: "dots", frame: "label-bottom", frame_text: "SCAN ME" } },
    });
    expect(vi.mocked(sessionApi.requestBlob).mock.calls.length).toBeGreaterThan(images);
  });

  it("deletes only after confirming, then returns to the list", async () => {
    detailApi();
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
    await click(t.deleteStart);
    expect(requestVoid).not.toHaveBeenCalled();
    await click(t.deleteConfirm);
    expect(requestVoid).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", { method: "DELETE" });
    expect(push).toHaveBeenCalledWith("/app");
  });

  it("leaves a locked code read-only", async () => {
    detailApi({ status: "locked" });
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
    expect(screen.getByText(t.lockedIntro)).toBeTruthy();
    expect(field(new RegExp(t.target)).matches(":disabled")).toBe(true); // via the fieldset
    expect(screen.queryByRole("button", { name: t.pause })).toBeNull();
    expect(screen.queryByRole("button", { name: t.deleteStart })).toBeNull();
  });

  it("says when the code does not exist", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      throw new ApiError(404, "not_found", "nope");
    });
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    expect(await screen.findByText(t.notFound)).toBeTruthy();
  });
});
