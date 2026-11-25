// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { format } from "@/i18n/config";
import { RequireSession } from "@/features/auth/require-session";
import { en } from "@/i18n/messages/en";
import { plural } from "@/i18n/plural";
import { ApiError, sessionApi } from "@/lib/api";
import type { CodeStats, DynamicCode, Folder } from "@/lib/api/types";
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

  it("opens at the section a link from the list names, with its heading focused", async () => {
    vi.stubGlobal("location", { assign, replace: vi.fn(), pathname: "/app/codes/c1", search: "", hash: "#scans" });
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    detailApi();
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
    await waitFor(() => expect(scrolled).toEqual(["scans"]));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: t.scansTitle }));
    expect(document.getElementById("destination")).toBeTruthy();
    expect(document.getElementById("design")).toBeTruthy();
  });

  it("stays at the top for a hash it does not know", async () => {
    vi.stubGlobal("location", { assign, replace: vi.fn(), pathname: "/app/codes/c1", search: "", hash: "#delete" });
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    detailApi();
    withSession(<CodeDetail t={t} generator={en.generator} templates={en.templates} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
    expect(scroll).not.toHaveBeenCalled();
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
