// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { format } from "@/i18n/config";
import { RequireSession } from "@/features/auth/require-session";
import { en } from "@/i18n/messages/en";
import { plural } from "@/i18n/plural";
import { ApiError, sessionApi } from "@/lib/api";
import type { Campaign, CodeStats, DynamicCode, Folder } from "@/lib/api/types";
import { EMPTY_CAMPAIGN } from "./campaign/rules";
import { CodeDetail } from "./code-detail";
import { CodeForm } from "./code-form";
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
  folder_id: null,
  campaign: EMPTY_CAMPAIGN,
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
  const detailApi = (overrides: Partial<DynamicCode> = {}, folders: Folder[] = [], role: "owner" | "viewer" = "owner") =>
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return { ...me, workspaces: [{ ...me.workspaces[0], role }] };
      if (path === "/v1/workspaces/w1/folders") return { folders };
      if (path === "/v1/workspaces/w1/codes/c1" && !opts?.method) return { code: { ...code, ...overrides } };
      if (path === "/v1/workspaces/w1/codes/c1/stats") return stats;
      if (path === "/v1/workspaces/w1/codes/c1" && opts?.method === "PATCH") {
        const body = opts.body as Partial<DynamicCode> & { campaign?: Campaign | null };
        const before = { ...code, ...overrides };
        // Like the API: a null campaign clears the details, the object stays.
        return { code: { ...before, ...body, campaign: body.campaign === null ? EMPTY_CAMPAIGN : (body.campaign ?? before.campaign) } };
      }
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

  describe("folder", () => {
    const f = t.folders;
    const folder = (id: string, name: string): Folder => ({ id, name, code_count: 1, created_at: code.created_at, updated_at: code.updated_at });
    const folders = [folder("f2", "Events"), folder("f1", "Brunch")];
    const open = async (overrides: Partial<DynamicCode> = {}, list = folders, role: "owner" | "viewer" = "owner") => {
      detailApi(overrides, list, role);
      withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
      await screen.findByRole("heading", { name: "Menu", level: 1 });
    };
    const picker = () => screen.findByRole("combobox", { name: f.detailTitle }) as Promise<HTMLSelectElement>;
    const patches = () => request.mock.calls.filter(([, o]) => o?.method === "PATCH").map(([, o]) => o?.body);

    it("offers No folder and each folder, with the current one chosen", async () => {
      await open({ folder_id: "f1" });
      const select = await picker();
      expect(select.value).toBe("f1");
      expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([f.none, "Events", "Brunch"]);
    });

    it("moves the code into a folder and says so", async () => {
      await open();
      const select = await picker();
      expect(select.value).toBe("none");
      await act(async () => void fireEvent.change(select, { target: { value: "f1" } }));
      expect(patches()).toEqual([{ folder_id: "f1" }]);
      expect(screen.getByText(format(f.movedOne, { folder: "Brunch" }))).toBeTruthy();
      expect(((await picker()) as HTMLSelectElement).value).toBe("f1");
    });

    it("takes the code out of its folder with No folder", async () => {
      await open({ folder_id: "f1" });
      const select = await picker(); // found outside act: state updates wait for it to end
      await act(async () => void fireEvent.change(select, { target: { value: "none" } }));
      expect(patches()).toEqual([{ folder_id: null }]);
      expect(screen.getByText(f.movedOut)).toBeTruthy();
      expect(((await picker()) as HTMLSelectElement).value).toBe("none");
    });

    it("keeps the chosen folder out of the request when it is the current one", async () => {
      await open({ folder_id: "f1" });
      const select = await picker();
      await act(async () => void fireEvent.change(select, { target: { value: "f1" } }));
      expect(patches()).toEqual([]);
    });

    it("shows why a move failed and keeps the folder the code is in", async () => {
      await open({ folder_id: "f1" });
      const select = await picker(); // the folders are loaded before the API starts failing
      request.mockImplementation(async (path, opts) => {
        if (opts?.method === "PATCH") throw new ApiError(422, "validation_error", "folder", "folder_id");
        throw new Error(`unexpected ${path}`);
      });
      await act(async () => void fireEvent.change(select, { target: { value: "f2" } }));
      expect(screen.getAllByRole("alert").some((a) => a.textContent === plural("en", f.moveFolderGone, 1))).toBe(true);
      expect(((await picker()) as HTMLSelectElement).value).toBe("f1");
    });

    it("says a locked code cannot be moved", async () => {
      await open({ folder_id: "f1" });
      const select = await picker();
      request.mockImplementation(async () => {
        throw new ApiError(409, "code_locked", "locked");
      });
      await act(async () => void fireEvent.change(select, { target: { value: "f2" } }));
      expect(screen.getAllByRole("alert").some((a) => a.textContent === t.errors.locked)).toBe(true);
    });

    it("leaves a locked code's folder as it is", async () => {
      await open({ status: "locked", folder_id: "f1" });
      expect((await picker()).matches(":disabled")).toBe(true); // via the fieldset
    });

    it("is hidden for viewers, and when there are no folders to choose", async () => {
      await open({}, folders, "viewer");
      expect(screen.queryByRole("combobox", { name: f.detailTitle })).toBeNull();
      cleanup();
      await open({}, []);
      expect(screen.queryByRole("combobox", { name: f.detailTitle })).toBeNull();
    });
  });

  describe("campaign", () => {
    const c = t.campaign;
    const full: Campaign = { start_date: "2026-12-01", end_date: "2026-12-31", print_run: 5000, medium: "poster", medium_other: null };
    const open = async (overrides: Partial<DynamicCode> = {}, role: "owner" | "viewer" = "owner") => {
      detailApi(overrides, [], role);
      withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
      await screen.findByRole("heading", { name: "Menu", level: 1 });
    };
    const section = () => within(screen.getByRole("region", { name: c.title }));
    const input = (label: string) => section().getByLabelText(label) as HTMLInputElement;
    const set = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
    const medium = () => section().getByRole("combobox", { name: c.medium }) as HTMLSelectElement;
    const patches = () => request.mock.calls.filter(([, o]) => o?.method === "PATCH").map(([, o]) => o?.body);
    // Scoped to the section: the page has other Save and Cancel buttons.
    const press = (name: string) => act(async () => void fireEvent.click(section().getByRole("button", { name })));
    const save = () => press(t.save);
    // The messages shown: field errors and the form alert (whose live region stays rendered when empty).
    const alerts = () =>
      section()
        .getAllByRole("alert")
        .map((a) => a.textContent)
        .filter(Boolean);

    it("says there are no details yet and offers to add them", async () => {
      await open();
      expect(section().getByText(c.empty)).toBeTruthy();
      expect(section().getByRole("button", { name: c.add })).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
    });

    it("shows the details with dates and numbers in the reader's format", async () => {
      await open({ campaign: { ...full, medium: "other", medium_other: "Trade fair" } });
      const list = section();
      expect(list.getByText("Dec 1, 2026")).toBeTruthy();
      expect(list.getByText("Dec 31, 2026")).toBeTruthy();
      expect(list.getByText("5,000")).toBeTruthy();
      expect(list.getByText("Trade fair")).toBeTruthy();
      expect(list.getByRole("button", { name: c.edit })).toBeTruthy();
    });

    it("shows what is not set, and a medium by its name", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, medium: "business_card" } });
      expect(section().getByText(c.media.business_card)).toBeTruthy();
      expect(section().getAllByText(c.notSet)).toHaveLength(3);
    });

    it("groups the media into print and digital, with not set first and other last", async () => {
      await open();
      await press(c.add);
      const select = medium();
      expect(select.value).toBe("");
      expect([...select.querySelectorAll("optgroup")].map((g) => g.label)).toEqual([c.groupPrint, c.groupDigital]);
      const options = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(options).toHaveLength(19);
      expect(options[0]).toBe(c.mediumNone);
      expect(options[1]).toBe(c.media.poster);
      expect(options[13]).toBe(c.media.website);
      expect(options[18]).toBe(c.media.other);
    });

    it("saves the whole campaign, shows it and returns focus to Edit", async () => {
      await open();
      await press(c.add);
      expect(document.activeElement).toBe(input(c.start));
      set(c.start, "2026-12-01");
      set(c.end, "2026-12-31");
      set(c.printRun, "5000");
      fireEvent.change(medium(), { target: { value: "poster" } });
      await save();
      expect(patches()).toEqual([{ campaign: full }]);
      expect(section().getByText(c.saved)).toBeTruthy();
      expect(section().getByText(c.media.poster)).toBeTruthy();
      expect(section().queryByLabelText(c.start)).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.edit })));
    });

    it("asks which medium only for other, without moving focus, and requires an answer", async () => {
      await open();
      await press(c.add);
      expect(section().queryByLabelText(c.otherLabel)).toBeNull();
      medium().focus();
      await act(async () => void fireEvent.change(medium(), { target: { value: "other" } }));
      expect(input(c.otherLabel)).toBeTruthy();
      expect(document.activeElement).toBe(medium()); // arrowing through the list must not throw the reader out of it
      await save();
      expect(patches()).toEqual([]);
      expect(alerts()).toEqual([c.errors.otherRequired]);
      expect(input(c.otherLabel).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(input(c.otherLabel));
      set(c.otherLabel, "  Trade   fair ");
      await save();
      expect(patches()).toEqual([{ campaign: { ...EMPTY_CAMPAIGN, medium: "other", medium_other: "Trade fair" } }]);
    });

    it("refuses an end before the start without calling the API", async () => {
      await open({ campaign: full });
      await press(c.edit);
      expect(input(c.start).value).toBe("2026-12-01");
      expect(input(c.end).min).toBe("2026-12-01");
      set(c.end, "2026-11-30");
      await save();
      expect(patches()).toEqual([]);
      expect(alerts()).toEqual([c.errors.endBeforeStart]);
      expect(document.activeElement).toBe(input(c.end));
    });

    it("refuses a print run that is not a whole number in range, naming the range", async () => {
      await open();
      await press(c.add);
      set(c.printRun, "1e5");
      await save();
      expect(patches()).toEqual([]);
      expect(alerts()).toEqual([format(c.errors.printRun, { min: "1", max: "100,000,000" })]);
    });

    it("closes without a request when nothing changed", async () => {
      await open({ campaign: full });
      await press(c.edit);
      await save();
      expect(patches()).toEqual([]);
      expect(section().queryByLabelText(c.start)).toBeNull();
      expect(section().queryByText(c.saved)).toBeNull();
    });

    it("cancels with the button and with Escape, keeping the details and returning focus", async () => {
      await open({ campaign: full });
      await press(c.edit);
      set(c.printRun, "9");
      await press(t.cancel);
      expect(patches()).toEqual([]);
      expect(section().getByText("5,000")).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.edit })));
      await press(c.edit);
      expect(input(c.printRun).value).toBe("5000"); // the abandoned edit is gone
      await act(async () => void fireEvent.keyDown(input(c.printRun), { key: "Escape" }));
      expect(section().queryByLabelText(c.printRun)).toBeNull();
    });

    it("clears every field to null when the form is emptied", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, print_run: 12 } });
      await press(c.edit);
      set(c.printRun, "");
      await save();
      expect(patches()).toEqual([{ campaign: null }]);
      expect(section().getByText(c.removed)).toBeTruthy();
      expect(section().getByText(c.empty)).toBeTruthy();
    });

    it("removes all details only after confirming", async () => {
      await open({ campaign: full });
      await press(c.edit);
      await press(c.remove);
      expect(patches()).toEqual([]);
      expect(section().getByText(c.removeConfirm)).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: t.cancel })));
      await press(t.cancel); // back to the form, nothing removed
      expect(input(c.printRun).value).toBe("5000");
      await press(c.remove);
      await press(c.removeYes);
      expect(patches()).toEqual([{ campaign: null }]);
      expect(section().getByText(c.removed)).toBeTruthy();
      expect(section().getByRole("button", { name: c.add })).toBeTruthy();
    });

    it("offers no removal while there is nothing to remove", async () => {
      await open();
      await press(c.add);
      expect(section().queryByRole("button", { name: c.remove })).toBeNull();
    });

    it("puts the API's refusal on its field", async () => {
      await open();
      await press(c.add);
      set(c.end, "2026-12-31");
      request.mockRejectedValueOnce(new ApiError(422, "validation_error", "bad", "campaign.end_date"));
      await save();
      expect(alerts()).toEqual([c.errors.dateRange]);
      expect(input(c.end).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(input(c.end));
    });

    it("says so when the code was locked meanwhile, and turns read-only", async () => {
      await open({ campaign: full });
      await press(c.edit);
      set(c.printRun, "6000");
      request.mockImplementation(async (path, opts) => {
        if (path === "/v1/workspaces/w1/codes/c1" && opts?.method === "PATCH") throw new ApiError(409, "code_locked", "locked");
        if (path === "/v1/workspaces/w1/codes/c1") return { code: { ...code, campaign: full, status: "locked" } };
        if (path === "/v1/workspaces/w1/codes/c1/stats") return stats;
        if (path === "/v1/workspaces/w1/folders") return { folders: [] };
        return me;
      });
      await save();
      await waitFor(() => expect(section().queryByLabelText(c.printRun)).toBeNull());
      expect(alerts()).toEqual([t.errors.locked]);
      expect(section().getByText("5,000")).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
      const region = screen.getByRole("region", { name: c.title });
      await waitFor(() => expect(region.contains(document.activeElement)).toBe(true)); // not dropped to <body>
    });

    it("goes to the login page on 401", async () => {
      await open();
      await press(c.add);
      set(c.printRun, "5");
      request.mockRejectedValueOnce(new ApiError(401, "unauthorized", "no session"));
      await save();
      expect(window.location.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });

    it("sends one request when saved twice while busy", async () => {
      await open();
      await press(c.add);
      set(c.printRun, "5");
      let finish: (v: unknown) => void = () => {};
      request.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      const button = section().getByRole("button", { name: t.save });
      await act(async () => {
        fireEvent.click(button);
        fireEvent.click(button);
      });
      expect(patches()).toHaveLength(1);
      await act(async () => finish({ code: { ...code, campaign: { ...EMPTY_CAMPAIGN, print_run: 5 } } }));
      expect(section().getByText(c.saved)).toBeTruthy();
    });

    it("keeps the form open while a save is running: Cancel, Escape and the medium wait", async () => {
      await open({ campaign: full });
      await press(c.edit);
      set(c.printRun, "6000");
      let finish: (v: unknown) => void = () => {};
      let fail: (e: unknown) => void = () => {};
      request.mockImplementationOnce(() => new Promise((resolve, reject) => ((finish = resolve), (fail = reject))));
      await save();
      await press(t.cancel);
      await act(async () => void fireEvent.keyDown(input(c.printRun), { key: "Escape" }));
      fireEvent.change(medium(), { target: { value: "flyer" } });
      expect(input(c.printRun).value).toBe("6000"); // still the form, still what was sent
      expect(medium().value).toBe("poster");
      await act(async () => fail(new ApiError(500, "internal_error", "boom")));
      expect(alerts()).toEqual([t.errors.generic]); // the failure reaches the reader
      expect(patches()).toHaveLength(1);
      void finish;
    });

    it("leaves the form alone on Escape while a text is being composed", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, medium: "other", medium_other: "Fair" } });
      await press(c.edit);
      expect(document.activeElement).toBe(input(c.start)); // "other" already chosen: no focus jump on opening
      await act(async () => void fireEvent.keyDown(input(c.otherLabel), { key: "Escape", isComposing: true }));
      expect(input(c.otherLabel).value).toBe("Fair");
    });

    it("names the confirmation, leaves it on Escape, and returns to the form with focus when removing fails", async () => {
      await open({ campaign: full });
      await press(c.edit);
      await press(c.remove);
      const step = section().getByRole("group", { name: c.removeConfirm });
      await act(async () => void fireEvent.keyDown(step, { key: "Escape" }));
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.remove })));
      expect(patches()).toEqual([]);
      await press(c.remove);
      request.mockRejectedValueOnce(new ApiError(500, "internal_error", "boom"));
      await press(c.removeYes);
      expect(alerts()).toEqual([t.errors.generic]);
      expect(input(c.printRun).value).toBe("5000");
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.remove })));
    });

    it("shows a medium this version does not know by its API name", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, medium: "podcast" as Campaign["medium"] } });
      expect(section().getByText("podcast")).toBeTruthy();
    });

    it("treats a code from an API without campaigns as having none", async () => {
      await open({ campaign: undefined as unknown as Campaign });
      expect(section().getByText(c.empty)).toBeTruthy();
      await press(c.add);
      set(c.printRun, "7");
      await save();
      expect(patches()).toEqual([{ campaign: { ...EMPTY_CAMPAIGN, print_run: 7 } }]);
    });

    it("is read-only for viewers and on a locked code", async () => {
      await open({ campaign: full }, "viewer");
      expect(section().getByText("5,000")).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
      cleanup();
      await open({}, "viewer");
      expect(section().getByText(c.empty)).toBeTruthy();
      expect(section().queryByRole("button", { name: c.add })).toBeNull();
      cleanup();
      await open({ campaign: full, status: "locked" });
      expect(section().getByText(c.media.poster)).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
    });
  });

  describe("custom short link", () => {
    const origin = "http://localhost:8180/";
    const rules = { min: 4, max: 40, changes: 3, slugs: 50 };
    const custom = { short_code: "my-shop", short_url: `${origin}my-shop` };
    const render_ = () =>
      withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    const open = async () => {
      render_();
      await screen.findByRole("heading", { name: "Menu", level: 1 });
      await click(t.editLink);
    };
    const editor = () => within(screen.getByRole("form", { name: t.editLink }));
    const patches = () => request.mock.calls.filter(([, o]) => o?.method === "PATCH");
    const failWith = (err: ApiError) => {
      detailApi();
      const base = request.getMockImplementation()!;
      request.mockImplementation(async (path, opts) => {
        if (opts?.method === "PATCH") throw err;
        return base(path, opts);
      });
    };
    const save = () => act(async () => void fireEvent.click(editor().getByRole("button", { name: t.save })));
    const alerts = () => screen.getAllByRole("alert").map((a) => a.textContent);

    it("opens an editor with the origin in the input row, the rule as help and the note, focused in an empty field", async () => {
      detailApi();
      await open();
      const input = field(t.slugLabel);
      expect(document.activeElement).toBe(input);
      expect(input.value).toBe(""); // a generated code is never a valid custom link
      expect(screen.getByText(origin)).toBeTruthy();
      expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe(
        format(t.slugHelp, { origin, ...rules }),
      );
      expect(screen.getByText(format(t.slugNote, rules))).toBeTruthy();
      expect(screen.queryByRole("button", { name: t.editLink })).toBeNull();
    });

    it("prefills a custom link and selects it all, so typing replaces it", async () => {
      detailApi(custom);
      await open();
      const input = field(t.slugLabel);
      expect(input.value).toBe("my-shop");
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, 7]);
    });

    it("cancels without calling the API and returns focus to the edit control", async () => {
      detailApi();
      await open();
      type(t.slugLabel, "changed-link");
      await act(async () => void fireEvent.click(editor().getByRole("button", { name: t.cancel })));
      expect(patches()).toHaveLength(0);
      expect(screen.queryByRole("textbox", { name: t.slugLabel })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: t.editLink })));
    });

    it("cancels on Escape", async () => {
      detailApi();
      await open();
      await act(async () => void fireEvent.keyDown(field(t.slugLabel), { key: "Escape" }));
      expect(screen.queryByRole("textbox", { name: t.slugLabel })).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: t.editLink })));
    });

    it.each([
      ["empty", ""],
      ["too short", "abc"],
      ["too long", "a".repeat(41)],
      ["uppercase", "MyShop"],
      ["leading hyphen", "-shop"],
      ["trailing hyphen", "shop-"],
      ["double hyphen", "my--shop"],
      ["a space inside", "my shop"],
      ["a slash", "my/shop"],
      ["non-ASCII letters", "caf\u00e9-shop"],
    ])("refuses %s on the client and focuses the field", async (_, value) => {
      detailApi();
      await open();
      type(t.slugLabel, value);
      await save();
      expect(patches()).toHaveLength(0);
      expect(screen.getByText(format(t.errors.slugShape, rules))).toBeTruthy();
      expect(field(t.slugLabel).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(field(t.slugLabel));
    });

    it("announces a field error when Enter submits from inside the input", async () => {
      detailApi();
      await open();
      type(t.slugLabel, "abc");
      await act(async () => void fireEvent.submit(screen.getByRole("form", { name: t.editLink })));
      expect(alerts()).toContain(format(t.errors.slugShape, rules));
      expect(patches()).toHaveLength(0);
    });

    it("saves the trimmed slug, shows and copies the new link, redraws the image, and focuses the edit control", async () => {
      detailApi();
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      await open();
      const images = vi.mocked(sessionApi.requestBlob).mock.calls.length;
      const drawn = vi.mocked(URL.createObjectURL).mock.calls.length;
      type(t.slugLabel, "  my-shop  ");
      request.mockImplementation(async (path, opts) => {
        if (path === "/v1/me") return me;
        if (path === "/v1/workspaces/w1/codes/c1" && opts?.method === "PATCH") return { code: { ...code, ...custom } };
        throw new Error(`unexpected ${path}`);
      });
      await save();
      expect(patches()[0]).toEqual(["/v1/workspaces/w1/codes/c1", { method: "PATCH", body: { short_code: "my-shop" } }]);
      expect(screen.getByText(custom.short_url)).toBeTruthy();
      expect(screen.queryByText(code.short_url)).toBeNull();
      expect(screen.queryByRole("textbox", { name: t.slugLabel })).toBeNull();
      expect(screen.getByText(t.linkSaved).closest("[role=status]")).toBeTruthy();
      await waitFor(() => expect(vi.mocked(sessionApi.requestBlob).mock.calls.length).toBeGreaterThan(images));
      await waitFor(() => expect(vi.mocked(URL.createObjectURL).mock.calls.length).toBeGreaterThan(drawn));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:qr"); // the old preview is released
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: t.editLink })));
      await click(t.copy);
      expect(writeText).toHaveBeenCalledWith(custom.short_url);
    });

    it("lets a paused code be edited", async () => {
      detailApi({ status: "paused" });
      await open();
      expect(screen.getByRole("textbox", { name: t.slugLabel })).toBeTruthy();
    });

    it("sends one request when saved twice while busy", async () => {
      detailApi();
      const base = request.getMockImplementation()!;
      let release: () => void = () => {};
      request.mockImplementation(async (path, opts) => {
        if (opts?.method === "PATCH") {
          await new Promise<void>((r) => (release = r));
          return { code: { ...code, ...custom } };
        }
        return base(path, opts);
      });
      await open();
      type(t.slugLabel, "my-shop");
      const form = screen.getByRole("form", { name: t.editLink });
      await act(async () => {
        fireEvent.submit(form);
        fireEvent.submit(form);
      });
      expect(patches()).toHaveLength(1);
      await act(async () => release());
    });

    it("goes to the login page on 401", async () => {
      failWith(new ApiError(401, "unauthorized", "x"));
      await open();
      type(t.slugLabel, "my-shop");
      await save();
      expect(window.location.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });

    it("closes with focus back on Edit and no saved message when the slug is unchanged", async () => {
      detailApi(custom);
      await open();
      await save();
      expect(patches()).toHaveLength(0);
      expect(screen.queryByRole("textbox", { name: t.slugLabel })).toBeNull();
      expect(screen.queryByText(t.linkSaved)).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: t.editLink })));
    });

    it("clears the saved message after a moment and when Copy is used", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        detailApi();
        vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
        const patchReturns = (slug: string) =>
          request.mockImplementation(async (path, opts) => {
            if (path === "/v1/me") return me;
            if (opts?.method === "PATCH") return { code: { ...code, short_code: slug, short_url: origin + slug } };
            throw new Error(`unexpected ${path}`);
          });
        await open();
        patchReturns("my-shop");
        type(t.slugLabel, "my-shop");
        await save();
        expect(screen.getByText(t.linkSaved).closest("[role=status]")).toBeTruthy();
        await act(async () => void vi.advanceTimersByTime(2100));
        expect(screen.queryByText(t.linkSaved)).toBeNull();

        await click(t.editLink);
        patchReturns("other-shop");
        type(t.slugLabel, "other-shop");
        await save();
        expect(screen.getByText(t.linkSaved)).toBeTruthy();
        await click(t.copy);
        expect(screen.queryByText(t.linkSaved)).toBeNull();
        expect(screen.getByText(t.copied)).toBeTruthy();
        await act(async () => void vi.advanceTimersByTime(2100));
        expect(screen.queryByText(t.linkSaved)).toBeNull(); // does not come back with the copy note
      } finally {
        vi.useRealTimers();
      }
    });

    it.each([
      ["validation_error", 422, "short_code", "slugRefused"],
      ["short_code_taken", 409, undefined, "slugTaken"],
    ] as const)("shows %s at the field", async (errCode, status, errField, key) => {
      failWith(new ApiError(status, errCode, "x", errField));
      await open();
      type(t.slugLabel, "my-shop");
      await save();
      expect(screen.getByText(t.errors[key])).toBeTruthy();
      expect(field(t.slugLabel).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(field(t.slugLabel));
      expect(screen.getByText(code.short_url)).toBeTruthy(); // link unchanged
    });

    it.each([
      [new ApiError(409, "short_code_change_limit", "x"), () => format(t.errors.slugChangeLimit, rules)],
      [new ApiError(409, "short_code_workspace_limit", "x"), () => format(t.errors.slugWorkspaceLimit, rules)],
      [new ApiError(409, "code_locked", "x"), () => t.errors.locked],
      [new ApiError(403, "email_not_verified", "x"), () => t.errors.verifyFirst],
      [new ApiError(429, "rate_limited", "x", undefined, 30), () => format(auth.errors.rateLimited!, { seconds: 30 })],
      [new ApiError(500, "internal", "x"), () => t.errors.generic],
    ])("shows %s as the form alert and keeps the editor open", async (err, message) => {
      failWith(err);
      await open();
      type(t.slugLabel, "my-shop");
      await save();
      expect(alerts()).toContain(message());
      expect(screen.getByRole("textbox", { name: t.slugLabel })).toBeTruthy();
    });

    it("closes the editor if the code becomes locked while it is open", async () => {
      detailApi();
      const base = request.getMockImplementation()!;
      request.mockImplementation(async (path, opts) => {
        if (opts?.method === "PATCH") return { code: { ...code, status: "locked" } };
        return base(path, opts);
      });
      await open();
      await click(t.pause);
      expect(screen.queryByRole("textbox", { name: t.slugLabel })).toBeNull();
      expect(screen.queryByRole("button", { name: t.editLink })).toBeNull();
    });

    it("offers no edit control on a locked code", async () => {
      detailApi({ status: "locked" });
      render_();
      await screen.findByRole("heading", { name: "Menu", level: 1 });
      expect(screen.queryByRole("button", { name: t.editLink })).toBeNull();
    });
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
