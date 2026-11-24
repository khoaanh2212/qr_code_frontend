// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RequireSession } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import { en } from "@/i18n/messages/en";
import { plural } from "@/i18n/plural";
import { ApiError, sessionApi } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { clearThumbnailCache } from "./code-thumbnail";
import { CodesList } from "./codes-list";

const t = en.codes;
const l = t.list;
const me = {
  user: {
    id: "u1",
    email: "an@example.com",
    display_name: "An",
    role: "user" as const,
    email_verified: true,
    has_password: true,
    created_at: "2026-11-01T10:00:00Z",
  },
  workspaces: [{ id: "w1", name: "Personal", personal: true, role: "owner" }],
};
const code = (over: Partial<DynamicCode>): DynamicCode => ({
  id: "c1",
  short_code: "Ab3dE5gH",
  short_url: "http://localhost:8180/Ab3dE5gH",
  name: "Menu",
  target_url: "https://example.com/menu",
  design: {},
  status: "active",
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  ...over,
});
const menu = code({});
const wifi = code({ id: "c2", short_code: "Zz9yX8wV", short_url: "http://localhost:8180/Zz9yX8wV", name: "Wi-Fi", target_url: "https://cafe.example/wifi" });
const flyer = code({ id: "c3", short_code: "Fl1yEr00", short_url: "http://localhost:8180/Fl1yEr00", name: "Flyer", status: "paused" });

const LIST = "/v1/workspaces/w1/codes?limit=50";

let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let requestBlob: MockInstance<typeof sessionApi.requestBlob>;
let replace: ReturnType<typeof vi.fn>;

/** Serves /v1/me, the listed pages and PATCHes that echo the change. */
function serve(pages: Record<string, { codes: DynamicCode[]; next_cursor: string | null }>, patch?: (id: string, body: unknown) => DynamicCode) {
  request.mockImplementation(async (path, opts) => {
    if (path === "/v1/me") return me;
    if (opts?.method === "PATCH" && patch) return { code: patch(path.split("/").pop()!, opts.body) };
    const page = pages[path];
    if (page) return page;
    throw new Error(`unexpected ${opts?.method ?? "GET"} ${path}`);
  });
}

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
  requestBlob = vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  replace = vi.fn();
  vi.stubGlobal("location", { assign: vi.fn(), replace, pathname: "/vi/app", search: "" });
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

const show = (locale: "en" | "vi" = "en") =>
  render(
    <RequireSession messages={en.session}>
      <CodesList t={t} templatesLabel="Manage templates" locale={locale} />
    </RequireSession>,
  );
const card = (name: string) => screen.getByRole("article", { name });
const openMenu = (name: string) => fireEvent.click(screen.getByRole("button", { name: format(l.actions, { name }) }));
const pick = async (name: string) => act(async () => void fireEvent.click(screen.getByRole("menuitem", { name })));

describe("CodesList states", () => {
  it("shows skeleton cards while loading, marked busy", async () => {
    request.mockImplementation(async (path) => (path === "/v1/me" ? me : new Promise(() => {})));
    show();
    expect(await screen.findByText(l.loading)).toBeTruthy();
    expect(screen.getByRole("list", { busy: true })).toBeTruthy();
  });

  it("invites to create the first code when there are none, without a toolbar", async () => {
    serve({ [LIST]: { codes: [], next_cursor: null } });
    show();
    expect(await screen.findByRole("heading", { name: t.empty })).toBeTruthy();
    expect(screen.getByRole("link", { name: t.newCode }).getAttribute("href")).toBe("/app/codes/new");
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("offers a retry when the list fails, and loads again", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      throw new ApiError(503, "busy", "busy");
    });
    show();
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    serve({ [LIST]: { codes: [menu], next_cursor: null } });
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.retry })));
    expect(await screen.findByRole("article", { name: "Menu" })).toBeTruthy();
  });

  it("sends an expired session to the login page", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      throw new ApiError(401, "unauthorized", "no session");
    });
    show();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/vi/login?return_to=%2Fvi%2Fapp"));
  });
});

describe("CodesList cards", () => {
  it("shows each code's name, short link, destination and status, and loads more", async () => {
    serve({
      [LIST]: { codes: [menu], next_cursor: "n1" },
      [`${LIST}&cursor=n1`]: { codes: [code({ id: "c9", name: "", status: "paused" })], next_cursor: null },
    });
    show("vi");
    const first = await screen.findByRole("article", { name: "Menu" });
    expect(within(first).getByRole("link", { name: "Menu" }).getAttribute("href")).toBe("/vi/app/codes/c1");
    expect(within(first).getByText("localhost:8180/Ab3dE5gH")).toBeTruthy();
    expect(within(first).getByText("example.com/menu")).toBeTruthy();
    expect(within(first).getByText(t.status.active)).toBeTruthy();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.loadMore })));
    expect(card(t.untitled)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.loadMore })).toBeNull();
  });

  it("loads each code's image as a thumbnail", async () => {
    serve({ [LIST]: { codes: [menu], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    await waitFor(() => expect(requestBlob).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1/image?format=png&size=256"));
  });

  it("remembers the chosen layout", async () => {
    serve({ [LIST]: { codes: [menu], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("radio", { name: l.viewGrid }));
    expect(localStorage.getItem("proofqr.codes.view")).toBe("grid");
    cleanup();
    show();
    await screen.findByRole("article", { name: "Menu" });
    expect((screen.getByRole("radio", { name: l.viewGrid }) as HTMLInputElement).checked).toBe(true);
  });
});

describe("CodesList search and filters", () => {
  it("loads every page before searching, then shows only matches with a count", async () => {
    serve({
      [LIST]: { codes: [menu], next_cursor: "n1" },
      [`${LIST}&cursor=n1`]: { codes: [wifi, flyer], next_cursor: null },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("searchbox", { name: l.search }), { target: { value: "wifi" } });
    expect(await screen.findByRole("article", { name: "Wi-Fi" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Menu" })).toBeNull();
    expect(screen.getByText(format(l.countFiltered, { shown: 1, total: 3 }))).toBeTruthy();
    // Everything is loaded: no "Load more" under a filtered list.
    expect(screen.queryByRole("button", { name: t.loadMore })).toBeNull();
  });

  it("filters by status, and says so when nothing matches, with a way back", async () => {
    serve({ [LIST]: { codes: [menu, flyer], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    expect(screen.getByRole("article", { name: "Flyer" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: "Menu" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: l.search }), { target: { value: "nothing like this" } });
    expect(await screen.findByRole("heading", { name: l.noResults })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: l.clearFilters }));
    expect(screen.getByRole("article", { name: "Menu" })).toBeTruthy();
    expect((screen.getByRole("searchbox", { name: l.search }) as HTMLInputElement).value).toBe("");
  });

  it("sorts by name", async () => {
    serve({ [LIST]: { codes: [wifi, menu, flyer], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.sort }), { target: { value: "name" } });
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Flyer", "Menu", "Wi-Fi"]);
  });
});

describe("CodesList row actions", () => {
  it("pauses a code from its menu and announces it", async () => {
    serve({ [LIST]: { codes: [menu], next_cursor: null } }, (id, body) => ({ ...menu, id, ...(body as object) }));
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    await pick(l.pause);
    expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", { method: "PATCH", body: { status: "paused" } });
    expect(within(card("Menu")).getByText(t.status.paused)).toBeTruthy();
    expect(screen.getByText(l.pausedOne)).toBeTruthy();
  });

  it("offers no pause for a locked code", async () => {
    serve({ [LIST]: { codes: [code({ status: "locked" })], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    expect(screen.getByRole("menuitem", { name: l.pause }).getAttribute("aria-disabled")).toBe("true");
  });

  it("downloads the code as SVG", async () => {
    serve({ [LIST]: { codes: [menu], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    openMenu("Menu");
    await pick(l.downloadSvg);
    expect(click).toHaveBeenCalledOnce();
    expect(requestBlob).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1/image?format=svg&size=1024");
  });

  it("deletes a code after confirming", async () => {
    serve({ [LIST]: { codes: [menu, wifi], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    await pick(l.delete);
    const dialog = screen.getByRole("dialog", { name: format(l.deleteOneTitle, { name: "Menu" }) });
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: l.deleteConfirm })));
    expect(requestVoid).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", { method: "DELETE" });
    expect(screen.queryByRole("article", { name: "Menu" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(l.deletedOne)).toBeTruthy();
  });

  it("treats an already deleted code (404) as deleted, and moves focus to the list", async () => {
    serve({ [LIST]: { codes: [menu, wifi], next_cursor: null } });
    requestVoid.mockRejectedValueOnce(new ApiError(404, "not_found", "gone"));
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    await pick(l.delete);
    await act(async () => void fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: l.deleteConfirm })));
    expect(screen.queryByRole("article", { name: "Menu" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: t.title, level: 2 }));
  });

  it("fetches the next page when every listed code was deleted", async () => {
    serve({
      [LIST]: { codes: [menu], next_cursor: "n1" },
      [`${LIST}&cursor=n1`]: { codes: [wifi], next_cursor: null },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    await pick(l.delete);
    await act(async () => void fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: l.deleteConfirm })));
    expect(await screen.findByRole("article", { name: "Wi-Fi" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: t.empty })).toBeNull();
  });

  it("keeps the dialog open with an error when the delete fails", async () => {
    serve({ [LIST]: { codes: [menu], next_cursor: null } });
    requestVoid.mockRejectedValueOnce(new ApiError(503, "busy", "busy"));
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    await pick(l.delete);
    const dialog = screen.getByRole("dialog");
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: l.deleteConfirm })));
    expect(within(dialog).getByRole("alert").textContent).toBe(t.errors.generic);
    expect(screen.getByRole("article", { name: "Menu" })).toBeTruthy();
  });
});

describe("CodesList bulk actions", () => {
  it("selects all shown codes and pauses them, reporting the ones that failed", async () => {
    serve({ [LIST]: { codes: [menu, wifi], next_cursor: null } }, (id, body) => {
      if (id === "c2") throw new ApiError(503, "busy", "busy");
      return { ...menu, id, ...(body as object) };
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const all = screen.getByRole("checkbox", { name: l.selectAll }) as HTMLInputElement;
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }));
    expect(all.indeterminate).toBe(true);
    fireEvent.click(all);
    expect(all.checked).toBe(true);
    expect(screen.getByText(format(l.selected, { count: 2 }))).toBeTruthy();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.pause })));
    expect(within(card("Menu")).getByText(t.status.paused)).toBeTruthy();
    expect(within(card("Wi-Fi")).getByText(t.status.active)).toBeTruthy();
    expect(screen.getByText(plural("en", l.failed, 1))).toBeTruthy();
    // The failed code stays selected, so "try again" is one click.
    expect(screen.getByText(format(l.selected, { count: 1 }))).toBeTruthy();
  });

  it("deletes the selected codes after one confirmation", async () => {
    serve({ [LIST]: { codes: [menu, wifi, flyer], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Flyer" }) }));
    fireEvent.click(screen.getByRole("button", { name: l.delete }));
    const dialog = screen.getByRole("dialog", { name: plural("en", l.deleteManyTitle, 2) });
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: l.deleteConfirm })));
    expect(requestVoid).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Wi-Fi"]);
    expect(screen.queryByText(format(l.selected, { count: 2 }))).toBeNull();
  });

  it("retitles the dialog for the codes left after a partial failure", async () => {
    serve({ [LIST]: { codes: [menu, wifi, flyer], next_cursor: null } });
    requestVoid.mockImplementation(async (path) => {
      if (path.endsWith("/c3")) throw new ApiError(503, "busy", "busy");
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    fireEvent.click(screen.getByRole("button", { name: l.delete }));
    await act(async () => void fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: l.deleteConfirm })));
    const dialog = screen.getByRole("dialog", { name: format(l.deleteOneTitle, { name: "Flyer" }) });
    expect(within(dialog).getByRole("alert").textContent).toBe(plural("en", l.failed, 1));
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Flyer"]);
    expect(screen.queryByText(format(l.selected, { count: 2 }))).toBeNull();
  });

  it("drops codes hidden by a filter from the selection", async () => {
    serve({ [LIST]: { codes: [menu, flyer], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    expect(screen.getByText(format(l.selected, { count: 1 }))).toBeTruthy();
  });
});
