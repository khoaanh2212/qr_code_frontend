// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RequireSession } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import { en } from "@/i18n/messages/en";
import { plural } from "@/i18n/plural";
import { ApiError, sessionApi } from "@/lib/api";
import type { BulkResult, Folder, ListedCode } from "@/lib/api/types";
import { clearThumbnailCache } from "./code-thumbnail";
import { CodesList } from "./codes-list";
import { EMPTY_CAMPAIGN } from "../campaign/rules";

const t = en.codes;
const l = t.list;
const f = t.folders;
const LIMITS = { max: 60, folders: 100 };

const FOLDERS = "/v1/workspaces/w1/folders";
const LIST = "/v1/workspaces/w1/codes?limit=50";
const BULK = "/v1/workspaces/w1/codes/bulk";

const meAs = (role: "owner" | "editor" | "viewer") => ({
  user: {
    id: "u1",
    email: "an@example.com",
    display_name: "An",
    role: "user" as const,
    email_verified: true,
    has_password: true,
    created_at: "2026-11-01T10:00:00Z",
  },
  workspaces: [{ id: "w1", name: "Personal", personal: true, role }],
});

const folder = (id: string, name: string, code_count: number): Folder => ({
  id,
  name,
  code_count,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
});
// The API lists folders by name.
const brunch = folder("f1", "Brunch", 2);
const events = folder("f2", "Events", 0);

const code = (over: Partial<ListedCode>): ListedCode => ({
  id: "c1",
  short_code: "Ab3dE5gH",
  short_url: "http://localhost:8180/Ab3dE5gH",
  name: "Menu",
  target_url: "https://example.com/menu",
  design: {},
  status: "active",
  folder_id: null,
  campaign: EMPTY_CAMPAIGN,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  scans_total: 0,
  ...over,
});
const menu = code({});
const wifi = code({ id: "c2", short_code: "Zz9yX8wV", short_url: "http://localhost:8180/Zz9yX8wV", name: "Wi-Fi", folder_id: "f1" });
const flyer = code({ id: "c3", short_code: "Fl1yEr00", short_url: "http://localhost:8180/Fl1yEr00", name: "Flyer", folder_id: "f1" });
const page = (codes: ListedCode[], next_cursor: string | null = null) => ({ codes, next_cursor });

let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let replace: ReturnType<typeof vi.fn>;

type Handler = (body: unknown) => unknown;
/** Serves /v1/me and the routes of a test, keyed "METHOD path"; anything else fails the test. */
function routes(table: Record<string, Handler | object>, role: "owner" | "editor" | "viewer" = "owner") {
  request.mockImplementation(async (path, opts) => {
    if (path === "/v1/me") return meAs(role);
    const key = `${opts?.method ?? "GET"} ${path}`;
    if (!(key in table)) throw new Error(`unexpected ${key}`);
    const h = table[key];
    return typeof h === "function" ? (h as Handler)(opts?.body) : h;
  });
}
const folderList = (...folders: Folder[]) => ({ folders });
const sent = (method: string, path: string) =>
  request.mock.calls.filter(([p, o]) => p === path && (o?.method ?? "GET") === method).map(([, o]) => o?.body);
const bulkCalls = () => sent("POST", BULK) as { action: string; ids: string[]; folder_id: string | null }[];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  request = vi.spyOn(sessionApi, "request");
  requestVoid = vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
  vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  replace = vi.fn();
  vi.stubGlobal("location", { assign: vi.fn(), replace, pathname: "/app", search: "" });
  URL.createObjectURL = vi.fn(() => "blob:qr");
  URL.revokeObjectURL = vi.fn();
  localStorage.clear();
  clearThumbnailCache();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const show = () =>
  render(
    <RequireSession messages={en.session}>
      <CodesList t={t} templatesLabel="Manage templates" locale="en" />
    </RequireSession>,
  );
const nav = () => screen.getByRole("navigation", { name: f.nav });
const navButton = (name: string | RegExp) => within(nav()).getByRole("button", { name });
const card = (name: string) => screen.getByRole("article", { name });
const click = (el: HTMLElement) => act(async () => void fireEvent.click(el));
const openMenu = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const pick = (name: string) => click(screen.getByRole("menuitem", { name }));
const typeName = (value: string) => fireEvent.change(screen.getByRole("textbox", { name: f.name }), { target: { value } });
const cards = () => screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"));
const selectCode = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name }) }));
const dialog = () => screen.getByRole("dialog");
/** Narrow screens: the folders live in a panel opened from the toolbar. */
const openPanel = () => click(screen.getByRole("button", { name: l.filters }));
const panel = () => within(screen.getByRole("dialog", { name: l.filtersTitle }));
/** The texts of the alerts that say something (empty live regions stay mounted). */
const alerts = () =>
  screen
    .queryAllByRole("alert")
    .map((a) => a.textContent ?? "")
    .filter(Boolean);
const status = () => screen.getAllByRole("status").map((s) => s.textContent ?? "");

/** The usual setup: three codes, two folders, an unfiltered list. */
function standard(extra: Record<string, Handler | object> = {}, role: "owner" | "editor" | "viewer" = "owner") {
  routes(
    {
      [`GET ${FOLDERS}`]: () => folderList(events, brunch),
      [`GET ${LIST}`]: page([menu, wifi, flyer]),
      ...extra,
    },
    role,
  );
}

describe("folder filter", () => {
  it("lists All codes, No folder and each folder with its code count, the current one marked", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    const names = within(nav())
      .getAllByRole("button")
      .filter((b) => !b.getAttribute("aria-label")?.startsWith("Actions for"))
      .map((b) => b.textContent);
    expect(names.slice(0, 4)).toEqual([f.all, f.none, "Events0", "Brunch2"]);
    expect(navButton(f.all).getAttribute("aria-current")).toBe("true");
    expect(navButton(f.none).getAttribute("aria-current")).toBeNull();
    // The narrow-screen panel offers the same choices.
    await openPanel();
    expect(panel().getByRole("button", { name: /^Events/ })).toBeTruthy();
    expect(panel().getByRole("button", { name: f.all }).getAttribute("aria-current")).toBe("true");
    await click(panel().getByRole("button", { name: l.closePanel }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks the API for one folder's codes, marks it, and goes back to all codes", async () => {
    standard({ [`GET ${LIST}&folder=f1`]: page([wifi, flyer]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
    expect(navButton(/^Brunch/).getAttribute("aria-current")).toBe("true");
    expect(navButton(f.all).getAttribute("aria-current")).toBeNull();
    await click(navButton(f.all));
    await waitFor(() => expect(cards()).toEqual(["Menu", "Wi-Fi", "Flyer"]));
  });

  it("filters codes without a folder with ?folder=none", async () => {
    standard({ [`GET ${LIST}&folder=none`]: page([menu]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(f.none));
    await waitFor(() => expect(cards()).toEqual(["Menu"]));
    expect(request).toHaveBeenCalledWith(`${LIST}&folder=none`, expect.anything());
  });

  it("filters from the panel on narrow screens too, closes it, and keeps the order", async () => {
    standard({ [`GET ${LIST}&sort=name`]: page([menu, wifi, flyer]), [`GET ${LIST}&folder=f1&sort=name`]: page([flyer]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.sort }), { target: { value: "name" } });
    await waitFor(() => expect(request).toHaveBeenCalledWith(`${LIST}&sort=name`, expect.anything()));
    await openPanel();
    await click(panel().getByRole("button", { name: /^Brunch/ }));
    expect(screen.queryByRole("dialog")).toBeNull(); // a choice closes the panel: the list is the answer
    await waitFor(() => expect(cards()).toEqual(["Flyer"]));
    expect(navButton(/^Brunch/).getAttribute("aria-current")).toBe("true");
  });

  it("keeps the folder when the status filter changes", async () => {
    standard({ [`GET ${LIST}&folder=f1`]: page([wifi, flyer]), [`GET ${LIST}&status=paused&folder=f1`]: page([flyer]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    await waitFor(() => expect(cards()).toEqual(["Flyer"]));
  });

  it("shows the folder a code is in on its card", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    expect(within(card("Wi-Fi")).getByText("Brunch")).toBeTruthy();
    expect(within(card("Menu")).queryByText("Brunch")).toBeNull();
  });

  it("detects a folder deleted elsewhere from its empty first page, and falls back to all codes", async () => {
    // The API answers 200 with no codes for a well-formed id that no longer exists.
    let folders = [events, brunch];
    standard({
      [`GET ${FOLDERS}`]: () => folderList(...folders),
      [`GET ${LIST}&folder=f1`]: () => {
        folders = [events]; // deleted in another tab
        return page([]);
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(status().join(" ")).toContain(f.gone));
    await waitFor(() => expect(cards()).toEqual(["Menu", "Wi-Fi", "Flyer"]));
    expect(navButton(f.all).getAttribute("aria-current")).toBe("true");
    expect(screen.queryByText(t.loadFailed)).toBeNull();
    expect(alerts()).toEqual([]);
  });

  it("keeps an empty folder that still exists selected", async () => {
    standard({ [`GET ${LIST}&folder=f2`]: page([]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Events/));
    expect(await screen.findByRole("heading", { name: f.emptyFolder })).toBeTruthy();
    await waitFor(() => expect(sent("GET", FOLDERS).length).toBeGreaterThan(1)); // checked, silently
    expect(navButton(/^Events/).getAttribute("aria-current")).toBe("true");
    expect(status().join(" ")).not.toContain(f.gone);
  });

  it("falls back to all codes when the refreshed folder list no longer has the selected folder", async () => {
    let folders = [events, brunch];
    standard({
      [`GET ${FOLDERS}`]: () => folderList(...folders),
      [`GET ${LIST}&folder=f1`]: page([wifi, flyer]),
      [`PATCH /v1/workspaces/w1/codes/c2`]: () => ({ code: { ...wifi, folder_id: null } }),
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
    folders = [events]; // deleted in another tab
    openMenu(format(l.actions, { name: "Wi-Fi" }));
    await pick(f.move);
    fireEvent.change(within(dialog()).getByRole("combobox"), { target: { value: "none" } });
    await click(within(dialog()).getByRole("button", { name: f.moveConfirm }));
    await waitFor(() => expect(cards()).toEqual(["Menu", "Wi-Fi", "Flyer"]));
    expect(navButton(f.all).getAttribute("aria-current")).toBe("true");
    expect(status().join(" ")).toContain(f.gone);
  });

  it("explains an empty folder and offers the way back", async () => {
    standard({ [`GET ${LIST}&folder=f2`]: page([]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Events/));
    expect(await screen.findByRole("heading", { name: f.emptyFolder })).toBeTruthy();
    expect(screen.getByText(f.emptyFolderIntro)).toBeTruthy();
    await click(screen.getByRole("button", { name: f.showAll }));
    expect(await screen.findByRole("article", { name: "Menu" })).toBeTruthy();
  });

  it("says when every code is in a folder", async () => {
    standard({ [`GET ${LIST}&folder=none`]: page([]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(f.none));
    expect(await screen.findByRole("heading", { name: f.emptyNoFolder })).toBeTruthy();
  });

  it("keeps the list usable when the folders cannot be loaded, with a retry", async () => {
    let fail = true;
    standard({
      [`GET ${FOLDERS}`]: () => {
        if (fail) throw new ApiError(503, "busy", "busy");
        return folderList(brunch);
      },
    });
    show();
    expect(await screen.findByRole("article", { name: "Menu" })).toBeTruthy();
    expect(await screen.findByText(f.loadFailed)).toBeTruthy();
    fail = false;
    await click(screen.getByRole("button", { name: f.reload }));
    expect(await within(nav()).findByRole("button", { name: /^Brunch/ })).toBeTruthy();
    expect(screen.queryByText(f.loadFailed)).toBeNull();
  });

  it("renders folder names as text and keeps the full name of a long one available", async () => {
    const hostile = folder("f3", "<img src=x onerror=alert(1)>", 1);
    const long = folder("f4", "A very long folder name that needs to be cut short on a narrow screen", 3);
    standard({ [`GET ${FOLDERS}`]: () => folderList(hostile, long) });
    const { container } = show();
    await screen.findByRole("article", { name: "Menu" });
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(within(nav()).getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(within(nav()).getByTitle(long.name).className).toContain("truncate");
  });
});

describe("managing folders", () => {
  it("creates a folder: trims the name, adds it in order, announces it", async () => {
    let created = false;
    const fresh = folder("f9", "Catering", 0);
    standard({
      [`GET ${FOLDERS}`]: () => folderList(...(created ? [brunch, fresh, events] : [events, brunch])),
      [`POST ${FOLDERS}`]: () => {
        created = true;
        return { folder: fresh };
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(within(nav()).getByRole("button", { name: f.newFolder }));
    const input = screen.getByRole("textbox", { name: f.name });
    expect(document.activeElement).toBe(input);
    expect(screen.getByText(format(f.nameHelp, LIMITS))).toBeTruthy();
    typeName("  Catering ");
    await click(screen.getByRole("button", { name: f.create }));
    expect(sent("POST", FOLDERS)).toEqual([{ name: "Catering" }]);
    expect(screen.queryByRole("textbox", { name: f.name })).toBeNull();
    expect(status()).toContain(format(f.created, { name: "Catering" }));
    const buttons = within(nav()).getAllByRole("button").map((b) => b.textContent);
    expect(buttons.filter((b) => /^(Brunch|Catering|Events)\d/.test(b ?? ""))).toEqual(["Brunch2", "Catering0", "Events0"].sort());
  });

  it("does not send a blank name", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(within(nav()).getByRole("button", { name: f.newFolder }));
    typeName("   ");
    await click(screen.getByRole("button", { name: f.create }));
    expect(sent("POST", FOLDERS)).toEqual([]);
    expect(alerts()).toEqual([format(f.errors.nameInvalid, LIMITS)]);
  });

  it.each([
    ["folder_name_taken", 409, undefined, f.errors.nameTaken],
    ["validation_error", 422, "name", format(f.errors.nameInvalid, LIMITS)],
  ])("shows %s next to the name field and keeps what was typed", async (code, status, field, message) => {
    standard({
      [`POST ${FOLDERS}`]: () => {
        throw new ApiError(status, code, "refused", field);
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(within(nav()).getByRole("button", { name: f.newFolder }));
    typeName("Brunch");
    await click(screen.getByRole("button", { name: f.create }));
    const input = screen.getByRole("textbox", { name: f.name }) as HTMLInputElement;
    expect(input.value).toBe("Brunch");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(alerts()).toEqual([message]);
    // The message goes away once the name is edited.
    typeName("Brunch 2");
    expect(alerts()).toEqual([]);
  });

  it.each([
    [new ApiError(409, "folder_limit_reached", "limit"), format(f.errors.limit, LIMITS)],
    [new ApiError(429, "rate_limited", "slow", undefined, 30), format(f.errors.rateLimited, { seconds: 30 })],
    [new ApiError(503, "busy", "busy"), f.errors.busy],
    [new ApiError(500, "internal", "boom"), f.errors.generic],
  ])("shows a translated message for %#", async (error, message) => {
    standard({
      [`POST ${FOLDERS}`]: () => {
        throw error;
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(within(nav()).getByRole("button", { name: f.newFolder }));
    typeName("Catering");
    await click(screen.getByRole("button", { name: f.create }));
    expect(alerts()).toEqual([message]);
    expect(screen.getByRole("textbox", { name: f.name })).toBeTruthy(); // the form stays for a retry
  });

  it("cancels the form with Cancel and with Escape, handing focus back", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    const open = within(nav()).getByRole("button", { name: f.newFolder });
    open.focus();
    await click(open);
    await click(screen.getByRole("button", { name: t.cancel }));
    expect(screen.queryByRole("textbox", { name: f.name })).toBeNull();
    expect(document.activeElement).toBe(open);
    await click(open);
    fireEvent.keyDown(screen.getByRole("textbox", { name: f.name }), { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: f.name })).toBeNull();
  });

  it("renames a folder from its menu", async () => {
    const renamed = { ...events, name: "Parties" };
    let done = false;
    standard({
      [`GET ${FOLDERS}`]: () => folderList(...(done ? [brunch, renamed] : [events, brunch])),
      [`PATCH ${FOLDERS}/f2`]: () => {
        done = true;
        return { folder: renamed };
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Events" }));
    await pick(f.rename);
    const input = screen.getByRole("textbox", { name: f.name }) as HTMLInputElement;
    expect(input.value).toBe("Events");
    typeName("Parties");
    await click(screen.getByRole("button", { name: f.save }));
    expect(sent("PATCH", `${FOLDERS}/f2`)).toEqual([{ name: "Parties" }]);
    expect(navButton(/^Parties/)).toBeTruthy();
    expect(within(nav()).queryByRole("button", { name: /^Events/ })).toBeNull();
    expect(status()).toContain(format(f.renamed, { name: "Parties" }));
  });

  it("shows a name already in use when renaming", async () => {
    standard({
      [`PATCH ${FOLDERS}/f2`]: () => {
        throw new ApiError(409, "folder_name_taken", "taken");
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Events" }));
    await pick(f.rename);
    typeName("brunch");
    await click(screen.getByRole("button", { name: f.save }));
    expect(alerts()).toEqual([f.errors.nameTaken]);
  });

  it("deletes a folder after a confirmation that says its codes are kept", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Events" }));
    await pick(f.delete);
    const d = screen.getByRole("dialog", { name: format(f.deleteTitle, { name: "Events" }) });
    expect(within(d).getByText(f.deleteBody)).toBeTruthy();
    expect(f.deleteBody).toMatch(/not deleted/);
    expect(requestVoid).not.toHaveBeenCalled();
    await click(within(d).getByRole("button", { name: f.deleteConfirm }));
    expect(requestVoid).toHaveBeenCalledWith(`${FOLDERS}/f2`, { method: "DELETE" });
    expect(within(nav()).queryByRole("button", { name: /^Events/ })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(status()).toContain(format(f.deleted, { name: "Events" }));
    // The menu button that opened the dialog is gone: focus continues from the list's heading.
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: t.title, level: 2 }));
  });

  it("switches to all codes after deleting the selected folder", async () => {
    standard({ [`GET ${LIST}&folder=f1`]: page([wifi, flyer]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
    openMenu(format(l.actions, { name: "Brunch" }));
    await pick(f.delete);
    await click(within(dialog()).getByRole("button", { name: f.deleteConfirm }));
    await waitFor(() => expect(cards()).toEqual(["Menu", "Wi-Fi", "Flyer"]));
    expect(navButton(f.all).getAttribute("aria-current")).toBe("true");
    // The folder is gone for sure: no "no longer exists" note for our own delete.
    expect(status()).not.toContain(f.gone);
  });

  it("keeps the dialog open with an error when the delete fails, and treats 404 as deleted", async () => {
    standard();
    requestVoid.mockRejectedValueOnce(new ApiError(503, "busy", "busy"));
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Events" }));
    await pick(f.delete);
    await click(within(dialog()).getByRole("button", { name: f.deleteConfirm }));
    expect(within(dialog()).getByRole("alert").textContent).toBe(f.errors.busy);
    expect(navButton(/^Events/)).toBeTruthy();
    requestVoid.mockRejectedValueOnce(new ApiError(404, "not_found", "gone"));
    await click(within(dialog()).getByRole("button", { name: f.deleteConfirm }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(nav()).queryByRole("button", { name: /^Events/ })).toBeNull();
  });

  it("manages folders from the narrow-screen panel, which makes way for the form", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openPanel();
    await click(panel().getByRole("button", { name: f.newFolder }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: f.name })); // the form, not the Filters button
    await click(screen.getByRole("button", { name: t.cancel }));
    await openPanel();
    fireEvent.click(panel().getByRole("button", { name: format(l.actions, { name: "Events" }) }));
    await pick(f.rename);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByRole("textbox", { name: f.name }) as HTMLInputElement).value).toBe("Events");
  });

  it("says on the Filters button how many of its filters are on, since the panel hides them", async () => {
    standard({ [`GET ${LIST}&folder=f1`]: page([wifi, flyer]), [`GET ${LIST}&status=paused&folder=f1`]: page([flyer]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const button = screen.getByRole("button", { name: l.filters });
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
    expect(screen.getByRole("button", { name: format(l.filtersActive, { count: 1 }) })).toBe(button);
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    await waitFor(() => expect(cards()).toEqual(["Flyer"]));
    expect(screen.getByRole("button", { name: format(l.filtersActive, { count: 2 }) })).toBe(button);
  });

  it("offers the status filter in the panel too, for phones", async () => {
    standard({ [`GET ${LIST}&status=paused`]: page([flyer]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openPanel();
    fireEvent.change(panel().getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    await waitFor(() => expect(cards()).toEqual(["Flyer"]));
  });
});

describe("viewers", () => {
  it("can filter by folder but sees no folder, move or other write controls for folders", async () => {
    standard({ [`GET ${LIST}&folder=f1`]: page([wifi, flyer]) }, "viewer");
    show();
    await screen.findByRole("article", { name: "Menu" });
    expect(within(nav()).queryByRole("button", { name: f.newFolder })).toBeNull();
    await openPanel();
    expect(panel().queryByRole("button", { name: f.newFolder })).toBeNull();
    await click(panel().getByRole("button", { name: l.closePanel }));
    expect(screen.queryByRole("button", { name: format(l.actions, { name: "Brunch" }) })).toBeNull();
    openMenu(format(l.actions, { name: "Menu" }));
    expect(screen.queryByRole("menuitem", { name: f.move })).toBeNull();
    fireEvent.keyDown(screen.getByRole("menuitem", { name: l.downloadPng }), { key: "Escape" });
    selectCode("Menu");
    expect(screen.queryByRole("button", { name: f.moveAction })).toBeNull();
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
  });

  it("offers no move without folders to move into", async () => {
    standard({ [`GET ${FOLDERS}`]: folderList() });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Menu" }));
    expect(screen.queryByRole("menuitem", { name: f.move })).toBeNull();
  });
});

describe("moving one code", () => {
  const pickFolder = (value: string) => fireEvent.change(within(dialog()).getByRole("combobox"), { target: { value } });
  const confirm = () => click(within(dialog()).getByRole("button", { name: f.moveConfirm }));
  const openMove = async (name: string) => {
    openMenu(format(l.actions, { name }));
    await pick(f.move);
  };

  it("moves a code into a folder from its menu, shows it, and refreshes the counts", async () => {
    let moved = false;
    standard({
      [`GET ${FOLDERS}`]: () => folderList(events, moved ? { ...brunch, code_count: 3 } : brunch),
      [`PATCH /v1/workspaces/w1/codes/c1`]: () => {
        moved = true;
        return { code: { ...menu, folder_id: "f1" } };
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openMove("Menu");
    const d = screen.getByRole("dialog", { name: format(f.moveOneTitle, { name: "Menu" }) });
    expect(within(d).getByText(f.moveBody)).toBeTruthy();
    const select = within(d).getByRole("combobox") as HTMLSelectElement;
    // The current folder (none) is preselected; the picker lists "No folder" and each folder.
    expect(select.value).toBe("none");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([f.none, "Events", "Brunch"]);
    pickFolder("f1");
    await confirm();
    expect(sent("PATCH", "/v1/workspaces/w1/codes/c1")).toEqual([{ folder_id: "f1" }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(card("Menu")).getByText("Brunch")).toBeTruthy();
    expect(status()).toContain(format(f.movedOne, { folder: "Brunch" }));
    await waitFor(() => expect(navButton(/^Brunch/).textContent).toBe("Brunch3"));
  });

  it("takes a code out of its folder", async () => {
    standard({ [`PATCH /v1/workspaces/w1/codes/c2`]: () => ({ code: { ...wifi, folder_id: null } }) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openMove("Wi-Fi");
    expect((within(dialog()).getByRole("combobox") as HTMLSelectElement).value).toBe("f1");
    pickFolder("none");
    await confirm();
    expect(sent("PATCH", "/v1/workspaces/w1/codes/c2")).toEqual([{ folder_id: null }]);
    expect(within(card("Wi-Fi")).queryByText("Brunch")).toBeNull();
    expect(status()).toContain(f.movedOut);
  });

  it("does nothing when the code is moved to the folder it is already in", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openMove("Wi-Fi");
    await confirm();
    expect(sent("PATCH", "/v1/workspaces/w1/codes/c2")).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the dialog on Cancel without moving", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openMove("Menu");
    await click(within(dialog()).getByRole("button", { name: t.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent("PATCH", "/v1/workspaces/w1/codes/c1")).toEqual([]);
  });

  it("drops a code from the list when it leaves the folder being viewed", async () => {
    standard({
      [`GET ${LIST}&folder=f1`]: page([wifi, flyer]),
      [`PATCH /v1/workspaces/w1/codes/c2`]: () => ({ code: { ...wifi, folder_id: "f2" } }),
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(navButton(/^Brunch/));
    await waitFor(() => expect(cards()).toEqual(["Wi-Fi", "Flyer"]));
    await openMove("Wi-Fi");
    pickFolder("f2");
    await confirm();
    expect(cards()).toEqual(["Flyer"]);
  });

  it("offers no move for a locked code", async () => {
    standard({ [`GET ${LIST}`]: page([code({ status: "locked" })]) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Menu" }));
    expect(screen.getByRole("menuitem", { name: f.move }).getAttribute("aria-disabled")).toBe("true");
  });

  it("says a locked code cannot be moved", async () => {
    standard({
      [`PATCH /v1/workspaces/w1/codes/c1`]: () => {
        throw new ApiError(409, "code_locked", "locked");
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openMove("Menu");
    pickFolder("f1");
    await confirm();
    expect(status().join(" ")).toContain(t.errors.locked);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains a folder deleted in the meantime and refreshes the folders", async () => {
    let folders = [events, brunch];
    standard({
      [`GET ${FOLDERS}`]: () => folderList(...folders),
      [`PATCH /v1/workspaces/w1/codes/c1`]: () => {
        folders = [events];
        throw new ApiError(422, "validation_error", "folder", "folder_id");
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await openMove("Menu");
    pickFolder("f1");
    await confirm();
    expect(status().join(" ")).toContain(plural("en", f.moveFolderGone, 1));
    await waitFor(() => expect(within(nav()).queryByRole("button", { name: /^Brunch/ })).toBeNull());
  });
});

describe("moving codes in bulk", () => {
  const pickFolder = (value: string) => fireEvent.change(within(dialog()).getByRole("combobox"), { target: { value } });
  const confirm = () => click(within(dialog()).getByRole("button", { name: f.moveConfirm }));
  const ok = (c: ListedCode, folder_id: string | null): BulkResult => ({ id: c.id, result: "ok", code: { ...c, folder_id } });

  it("asks for a folder first, then moves the selection and reports each kind of result", async () => {
    const poster = code({ id: "c4", name: "Poster", short_code: "Po5teR00" });
    const gone = code({ id: "c5", name: "Gone", short_code: "Go5neR00" });
    standard(
      {
        [`GET ${LIST}`]: page([menu, wifi, flyer, poster, gone]),
        [`POST ${BULK}`]: () => ({
          results: [
            ok(menu, "f2"),
            { id: "c2", result: "locked" },
            { id: "c3", result: "folder_not_found" },
            { id: "c4", result: "not_found" },
            { id: "c5", result: "ok", code: { ...gone, folder_id: "f2" } },
          ],
        }),
      },
      "owner",
    );
    show();
    await screen.findByRole("article", { name: "Menu" });
    for (const n of ["Menu", "Wi-Fi", "Flyer", "Poster", "Gone"]) selectCode(n);
    await click(screen.getByRole("button", { name: f.moveAction }));
    expect(screen.getByRole("dialog", { name: plural("en", f.moveManyTitle, 5) })).toBeTruthy();
    // Nothing chosen yet: the dialog asks, and sends nothing.
    await confirm();
    expect(within(dialog()).getByRole("alert").textContent).toBe(f.chooseFirst);
    expect(bulkCalls()).toEqual([]);
    pickFolder("f2");
    await confirm();
    expect(bulkCalls()).toEqual([{ action: "move", ids: ["c1", "c2", "c3", "c4", "c5"], folder_id: "f2" }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    const said = status().join(" | ");
    expect(said).toContain(plural("en", f.movedMany, 2, { folder: "Events" }));
    expect(said).toContain(plural("en", f.moveLocked, 1));
    expect(said).toContain(plural("en", f.moveFolderGone, 1));
    // A code deleted elsewhere leaves the list; the codes that were not moved stay selected.
    expect(screen.queryByRole("article", { name: "Poster" })).toBeNull();
    expect(screen.getByText(format(l.selected, { count: 2 }))).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Wi-Fi" }) }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Flyer" }) }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }) as HTMLInputElement).checked).toBe(false);
    expect(within(card("Menu")).getByText("Events")).toBeTruthy();
  });

  it("takes the selection out of its folders with No folder", async () => {
    standard({ [`POST ${BULK}`]: (b) => ({ results: (b as { ids: string[] }).ids.map((id) => ok(id === "c2" ? wifi : flyer, null)) }) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    selectCode("Wi-Fi");
    selectCode("Flyer");
    await click(screen.getByRole("button", { name: f.moveAction }));
    pickFolder("none");
    await confirm();
    expect(bulkCalls()).toEqual([{ action: "move", ids: ["c2", "c3"], folder_id: null }]);
    expect(status()).toContain(plural("en", f.movedOutMany, 2));
  });

  // These render a hundred cards and more: a second or so here, near five on a CI runner.
  it("sends at most 100 codes per request, each with the folder", { timeout: 20_000 }, async () => {
    const many = Array.from({ length: 150 }, (_, i) => code({ id: `id${i}`, name: `Code ${i}` }));
    standard({
      [`GET ${LIST}`]: page(many),
      [`POST ${BULK}`]: (b) => ({ results: (b as { ids: string[] }).ids.map((id) => ok(many.find((c) => c.id === id)!, "f1")) }),
    });
    show();
    await screen.findByRole("article", { name: "Code 0" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    await click(screen.getByRole("button", { name: f.moveAction }));
    pickFolder("f1");
    await confirm();
    expect(bulkCalls().map((b) => [b.ids.length, b.folder_id])).toEqual([
      [100, "f1"],
      [50, "f1"],
    ]);
    expect(status()).toContain(plural("en", f.movedMany, 150, { folder: "Brunch" }));
  });

  // These render a hundred cards and more: a second or so here, near five on a CI runner.
  it("stops at the bulk limit with the wait, and keeps the rest selected", { timeout: 20_000 }, async () => {
    const many = Array.from({ length: 150 }, (_, i) => code({ id: `id${i}`, name: `Code ${i}` }));
    let calls = 0;
    standard({
      [`GET ${LIST}`]: page(many),
      [`POST ${BULK}`]: (b) => {
        if (++calls === 2) throw new ApiError(429, "rate_limited", "slow down", undefined, 42);
        return { results: (b as { ids: string[] }).ids.map((id) => ok(many.find((c) => c.id === id)!, "f1")) };
      },
    });
    show();
    await screen.findByRole("article", { name: "Code 0" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    await click(screen.getByRole("button", { name: f.moveAction }));
    pickFolder("f1");
    await confirm();
    expect(status().join(" | ")).toContain(format(l.bulkRateLimited, { seconds: 42 }));
    expect(screen.getByText(format(l.selected, { count: 50 }))).toBeTruthy();
  });

  it("reports a folder that vanished before the request, keeping the whole selection", async () => {
    standard({
      [`POST ${BULK}`]: () => {
        throw new ApiError(422, "validation_error", "folder", "folder_id");
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    await click(screen.getByRole("button", { name: f.moveAction }));
    pickFolder("f1");
    await confirm();
    expect(status().join(" ")).toContain(plural("en", f.moveFolderGone, 3));
    expect(screen.getByText(format(l.selected, { count: 3 }))).toBeTruthy();
  });

  it("refreshes the folder counts after a bulk move and after deleting codes", async () => {
    let counts = 2;
    standard({
      [`GET ${FOLDERS}`]: () => folderList(events, { ...brunch, code_count: counts }),
      [`POST ${BULK}`]: (b) => {
        const body = b as { action: string; ids: string[] };
        counts = body.action === "move" ? 3 : 1;
        return { results: body.ids.map((id) => (body.action === "move" ? ok(menu, "f1") : { id, result: "ok" as const })) };
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    selectCode("Menu");
    await click(screen.getByRole("button", { name: f.moveAction }));
    pickFolder("f1");
    await confirm();
    await waitFor(() => expect(navButton(/^Brunch/).textContent).toBe("Brunch3"));
    selectCode("Wi-Fi");
    await click(screen.getByRole("button", { name: l.delete }));
    await click(within(dialog()).getByRole("button", { name: l.deleteConfirm }));
    await waitFor(() => expect(navButton(/^Brunch/).textContent).toBe("Brunch1"));
  });
});

describe("folder list consistency", () => {
  const moveMenuToBrunch = async () => {
    openMenu(format(l.actions, { name: "Menu" }));
    await pick(f.move);
    fireEvent.change(within(dialog()).getByRole("combobox"), { target: { value: "f1" } });
    await click(within(dialog()).getByRole("button", { name: f.moveConfirm }));
  };

  it("keeps a folder created and selected while an older silent reload is in flight", async () => {
    const fresh = folder("f9", "Catering", 0);
    let created = false;
    let gets = 0;
    let release: (v: unknown) => void = () => {};
    standard({
      [`GET ${FOLDERS}`]: () => {
        if (++gets === 2) return new Promise((r) => (release = r)); // the reload after the move
        return folderList(...(created ? [brunch, fresh, events] : [events, brunch]));
      },
      [`POST ${FOLDERS}`]: () => {
        created = true;
        return { folder: fresh };
      },
      "PATCH /v1/workspaces/w1/codes/c1": () => ({ code: { ...menu, folder_id: "f1" } }),
      [`GET ${LIST}&folder=f9`]: page([menu]),
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await moveMenuToBrunch();
    await click(within(nav()).getByRole("button", { name: f.newFolder }));
    typeName("Catering");
    await click(screen.getByRole("button", { name: f.create }));
    await click(navButton(/^Catering/));
    await act(async () => release(folderList(events, brunch))); // the old answer, without Catering
    expect(navButton(/^Catering/).getAttribute("aria-current")).toBe("true");
    expect(status().join(" ")).not.toContain(f.gone);
  });

  it("does not bring back a folder deleted while an older silent reload is in flight", async () => {
    let gets = 0;
    let deleted = false;
    let release: (v: unknown) => void = () => {};
    standard({
      [`GET ${FOLDERS}`]: () => {
        if (++gets === 2) return new Promise((r) => (release = r));
        return folderList(...(deleted ? [brunch] : [events, brunch]));
      },
      "PATCH /v1/workspaces/w1/codes/c1": () => ({ code: { ...menu, folder_id: "f1" } }),
    });
    requestVoid.mockImplementation(async () => void (deleted = true));
    show();
    await screen.findByRole("article", { name: "Menu" });
    await moveMenuToBrunch();
    openMenu(format(l.actions, { name: "Events" }));
    await pick(f.delete);
    await click(within(dialog()).getByRole("button", { name: f.deleteConfirm }));
    await act(async () => release(folderList(events, brunch)));
    expect(within(nav()).queryByRole("button", { name: /^Events/ })).toBeNull();
  });
});

describe("folder names", () => {
  const create = async (raw: string) => {
    standard({ [`POST ${FOLDERS}`]: (b) => ({ folder: folder("f9", (b as { name: string }).name, 0) }) });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await click(within(nav()).getByRole("button", { name: f.newFolder }));
    typeName(raw);
    await click(screen.getByRole("button", { name: f.create }));
  };

  it("sends the name as the server counts it: whitespace runs collapsed, then at most 60 characters", async () => {
    const raw = `  ${"a".repeat(30)}${" ".repeat(20)}\t${"b".repeat(18)}  `; // 70 characters before collapsing
    expect(raw.length).toBeGreaterThan(60);
    await create(raw);
    expect(sent("POST", FOLDERS)).toEqual([{ name: `${"a".repeat(30)} ${"b".repeat(18)}` }]);
  });

  it("counts a decomposed accent as one character and sends the composed form", async () => {
    await create("e\u0301".repeat(60));
    expect(sent("POST", FOLDERS)).toEqual([{ name: "\u00e9".repeat(60) }]);
  });

  it("refuses 61 characters without asking the server", async () => {
    await create("x".repeat(61));
    expect(sent("POST", FOLDERS)).toEqual([]);
    expect(alerts()).toEqual([format(f.errors.nameInvalid, LIMITS)]);
  });
});

describe("codes and folders deleted elsewhere", () => {
  it("closes the rename form, reloads folders and says so when the folder is gone (404)", async () => {
    let folders = [events, brunch];
    standard({
      [`GET ${FOLDERS}`]: () => folderList(...folders),
      [`PATCH ${FOLDERS}/f2`]: () => {
        folders = [brunch];
        throw new ApiError(404, "not_found", "gone");
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Events" }));
    await pick(f.rename);
    typeName("Parties");
    await click(screen.getByRole("button", { name: f.save }));
    expect(screen.queryByRole("textbox", { name: f.name })).toBeNull();
    expect(status().join(" ")).toContain(f.notFound);
    expect(alerts()).toEqual([]);
    await waitFor(() => expect(within(nav()).queryByRole("button", { name: /^Events/ })).toBeNull());
  });

  it("removes a code from the list when moving it finds it deleted (404)", async () => {
    standard({
      "PATCH /v1/workspaces/w1/codes/c1": () => {
        throw new ApiError(404, "not_found", "gone");
      },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Menu" }));
    await pick(f.move);
    fireEvent.change(within(dialog()).getByRole("combobox"), { target: { value: "f1" } });
    await click(within(dialog()).getByRole("button", { name: f.moveConfirm }));
    expect(screen.queryByRole("article", { name: "Menu" })).toBeNull();
  });
});

describe("move dialog label", () => {
  it("names the select with its own label", async () => {
    standard();
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu(format(l.actions, { name: "Menu" }));
    await pick(f.move);
    expect(within(dialog()).getByRole("combobox", { name: f.moveTo })).toBeTruthy();
  });
});
