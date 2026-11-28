// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RequireSession } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import { en } from "@/i18n/messages/en";
import { plural } from "@/i18n/plural";
import { ApiError, sessionApi } from "@/lib/api";
import type { BulkResult, ListedCode } from "@/lib/api/types";
import { clearThumbnailCache } from "./code-thumbnail";
import { CodesList } from "./codes-list";
import { EMPTY_CAMPAIGN } from "../campaign/rules";

// The list reads `?ready=` through the router; each test sets what the address holds.
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

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
const code = (over: Partial<ListedCode>): ListedCode => ({
  id: "c1",
  short_code: "Ab3dE5gH",
  short_url: "http://localhost:8180/Ab3dE5gH",
  kind: "redirect",
  page: null,
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
const wifi = code({ id: "c2", short_code: "Zz9yX8wV", short_url: "http://localhost:8180/Zz9yX8wV", name: "Wi-Fi", target_url: "https://cafe.example/wifi" });
const flyer = code({ id: "c3", short_code: "Fl1yEr00", short_url: "http://localhost:8180/Fl1yEr00", name: "Flyer", status: "paused" });

const LIST = "/v1/workspaces/w1/codes?limit=50";
const FOLDERS = "/v1/workspaces/w1/folders";

let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let requestBlob: MockInstance<typeof sessionApi.requestBlob>;
let replace: ReturnType<typeof vi.fn>;

type Bulk = { action: string; ids: string[] };

/** Serves /v1/me, the listed pages, PATCHes that echo the change and bulk requests. */
function serve(
  pages: Record<string, { codes: ListedCode[]; next_cursor: string | null } | { code: ListedCode }>,
  patch?: (id: string, body: unknown) => ListedCode,
  bulk?: (body: Bulk) => BulkResult[],
) {
  request.mockImplementation(async (path, opts) => {
    if (path === "/v1/me") return me;
    if (path === FOLDERS) return { folders: [] };
    if (opts?.method === "PATCH" && patch) return { code: patch(path.split("/").pop()!, opts.body) };
    if (path === "/v1/workspaces/w1/codes/bulk" && opts?.method === "POST" && bulk) return { results: bulk(opts.body as Bulk) };
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
      <CodesList t={t} auth={en.auth} templatesLabel="Manage templates" locale={locale} />
    </RequireSession>,
  );
const card = (name: string) => screen.getByRole("article", { name });
const openMenu = (name: string) => fireEvent.click(screen.getByRole("button", { name: format(l.actions, { name }) }));
const pick = async (name: string) => act(async () => void fireEvent.click(screen.getByRole("menuitem", { name })));
/** Every bulk request sent, in order. */
const bulkCalls = () =>
  request.mock.calls.filter(([path, opts]) => path === "/v1/workspaces/w1/codes/bulk" && opts?.method === "POST").map(([, opts]) => opts?.body as Bulk);
/** Bulk results that apply the action to every id (pause/resume echo the code). */
const allOk = (codes: ListedCode[]) => (b: Bulk): BulkResult[] =>
  b.ids.map((id) => {
    const c = codes.find((x) => x.id === id)!;
    return b.action === "delete" ? { id, result: "ok" } : { id, result: "ok", code: { ...c, status: b.action === "pause" ? "paused" : "active" } };
  });

describe("CodesList card shortcuts", () => {
  it("links straight to a code's statistics, destination and design, and downloads from the thumbnail", async () => {
    serve({ [LIST]: { codes: [code({})], next_cursor: null } });
    show();
    const first = await screen.findByRole("article", { name: "Menu" });
    const link = (name: string) => within(first).getByRole("link", { name });
    expect(link(format(l.editDesignOf, { name: "Menu" })).getAttribute("href")).toBe("/app/codes/c1/design");
    // Statistics and destination are offered in words (the count, "Change"); their icons repeat
    // them for the mouse only, like the thumbnail: no second stop for the keyboard or a reader.
    for (const [name, target] of [
      [format(l.statsOf, { name: "Menu" }), "/app/codes/c1/insights"],
      [format(l.editDestinationOf, { name: "Menu" }), "/app/codes/c1/edit"],
    ]) {
      const icon = within(first).getByTitle(name); // hidden from the accessibility tree: found by its tooltip
      expect(icon.getAttribute("href")).toBe(target);
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.tabIndex).toBe(-1);
    }
    // "Change" beside the destination is the same way in, in words.
    expect(within(first).getByRole("link", { name: format(l.changeDestinationOf, { name: "Menu" }) }).textContent).toBe(l.changeDestination);
    const blobs = vi.spyOn(sessionApi, "requestBlob");
    blobs.mockClear();
    await act(async () => void fireEvent.click(within(first).getByRole("button", { name: format(l.downloadOf, { name: "Menu" }) })));
    expect(blobs).toHaveBeenCalledWith(expect.stringContaining("/codes/c1/image?format=png"));
  });

  it("keeps the shortcuts that change a code away from viewers and locked codes", async () => {
    serve({ [LIST]: { codes: [code({ status: "locked" })], next_cursor: null } });
    show();
    const first = await screen.findByRole("article", { name: "Menu" });
    expect(within(first).queryByTitle(format(l.editDestinationOf, { name: "Menu" }))).toBeNull();
    expect(within(first).queryByRole("link", { name: format(l.editDesignOf, { name: "Menu" }) })).toBeNull();
    expect(within(first).queryByRole("link", { name: format(l.changeDestinationOf, { name: "Menu" }) })).toBeNull();
    expect(within(first).getByTitle(format(l.statsOf, { name: "Menu" }))).toBeTruthy();
    expect(within(first).getByRole("link", { name: format(l.scansLink, { scans: plural("en", l.scans, 0) }) })).toBeTruthy();
  });

  it("keeps New dynamic code named by its text, which phones only hide visually", async () => {
    serve({ [LIST]: { codes: [code({})], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const link = screen.getByRole("link", { name: t.newCode });
    expect(link.getAttribute("href")).toBe("/app/codes/new");
    expect(link.textContent).toBe(t.newCode);
  });

  it("shows the list on a phone whatever layout was chosen on a wider screen", async () => {
    localStorage.setItem("proofqr.codes.view", "grid");
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("max-width: 639px"), addEventListener() {}, removeEventListener() {} }));
    serve({ [LIST]: { codes: [code({})], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const list = screen.getAllByRole("list").find((ul) => within(ul).queryByRole("article"));
    expect(list?.className).toContain("flex-col");
    expect(list?.className).not.toContain("grid-cols");
  });
});

describe("CodesList greeting a new code", () => {
  const r = t.ready;
  const NEW = "11111111-2222-4333-8444-555555555555";
  const GONE = "99999999-2222-4333-8444-555555555555";
  const arrive = (id = NEW) => {
    search = `?ready=${id}`;
  };
  afterEach(() => {
    search = "";
  });
  const fresh = code({ id: NEW, name: "Flyer", short_code: "Nn9wCode", short_url: "http://localhost:8180/Nn9wCode" });

  it("opens with the new code's download dialog, and drops the parameter from the address", async () => {
    arrive();
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    serve({ [LIST]: { codes: [fresh, code({})], next_cursor: null }, [`/v1/workspaces/w1/codes/${NEW}`]: { code: fresh } });
    show();
    const dialog = await screen.findByRole("dialog", { name: r.title });
    expect(await within(dialog).findByText("localhost:8180/Nn9wCode")).toBeTruthy();
    expect(replaceState).toHaveBeenCalledWith(window.history.state, "", "/vi/app"); // only `ready` goes
    expect(within(dialog).getByRole("link", { name: r.customize }).getAttribute("href")).toBe(`/app/codes/${NEW}/design`);
    const blobs = vi.spyOn(sessionApi, "requestBlob");
    blobs.mockClear();
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: l.downloadSvg })));
    expect(blobs).toHaveBeenCalledWith(expect.stringContaining(`/codes/${NEW}/image?format=svg`));
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: r.close })));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so and still closes when the new code cannot be loaded", async () => {
    arrive(GONE);
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
    serve({ [LIST]: { codes: [code({})], next_cursor: null } });
    show();
    // Not announced as ready: the dialog is named by what went wrong.
    const dialog = await screen.findByRole("dialog", { name: t.loadFailed });
    expect(within(dialog).queryByText(r.intro)).toBeNull();
    expect(within(dialog).queryByRole("button", { name: l.downloadPng })).toBeNull();
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: r.close })));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["..", ".", "c9", "../../me", "x".repeat(5000)])("ignores a value that is not a code id (%s): no dialog and no request for it", async (value) => {
    arrive(value);
    serve({ [LIST]: { codes: [code({})], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(request.mock.calls.map(([path]) => path).filter((path) => path !== "/v1/me" && path !== FOLDERS && path !== LIST)).toEqual([]);
  });

  it("shows no dialog on an ordinary visit", async () => {
    serve({ [LIST]: { codes: [code({})], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

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

  it("names a page code's destination as a hosted page (lists carry no page)", async () => {
    serve({ [LIST]: { codes: [code({ kind: "page", target_url: "", page: null })], next_cursor: null } });
    show();
    const first = await screen.findByRole("article", { name: "Menu" });
    expect(within(first).getByText(t.list.hostedPage)).toBeTruthy();
  });

  it("shows each code's scans and how many codes are listed", async () => {
    serve({
      [LIST]: { codes: [code({ scans_total: 1234 }), code({ id: "c2", name: "Wi-Fi", scans_total: 1 })], next_cursor: "n1" },
      [`${LIST}&cursor=n1`]: { codes: [flyer], next_cursor: null },
    });
    show();
    const first = await screen.findByRole("article", { name: "Menu" });
    // The count is the card's figure, and the way to the code's statistics.
    const scans = within(first).getByRole("link", { name: format(l.scansLink, { scans: plural("en", l.scans, 1234) }) });
    expect(scans.getAttribute("href")).toBe("/app/codes/c1/insights");
    expect(scans.textContent).toBe("1,234 scans");
    expect(within(card("Wi-Fi")).getByRole("link", { name: format(l.scansLink, { scans: plural("en", l.scans, 1) }) }).textContent).toBe("1 scan");
    // More pages remain: the count says so.
    expect(screen.getByText(plural("en", l.countMore, 2))).toBeTruthy();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.loadMore })));
    expect(await screen.findByText(plural("en", l.count, 3))).toBeTruthy();
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

describe("CodesList search, filters and order", () => {
  it("searches on the server once typing pauses, and pages through the results", async () => {
    serve({
      [LIST]: { codes: [menu, wifi], next_cursor: null },
      [`${LIST}&q=wifi`]: { codes: [wifi], next_cursor: "q1" },
      [`${LIST}&q=wifi&cursor=q1`]: { codes: [code({ id: "c7", name: "Wi-Fi 2" })], next_cursor: null },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const box = screen.getByRole("searchbox", { name: l.search });
    fireEvent.change(box, { target: { value: "w" } });
    fireEvent.change(box, { target: { value: "wifi" } });
    await waitFor(() => expect(screen.queryByRole("article", { name: "Menu" })).toBeNull());
    // One request for the settled text, none for every keystroke.
    expect(request.mock.calls.filter(([p]) => String(p).includes("q="))).toHaveLength(1);
    // Shown and announced.
    expect(screen.getAllByText(plural("en", l.matchesMore, 1)).length).toBeGreaterThan(0);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.loadMore })));
    expect(await screen.findByRole("article", { name: "Wi-Fi 2" })).toBeTruthy();
    expect(screen.getAllByText(plural("en", l.matches, 2)).length).toBeGreaterThan(0);
  });

  it("filters by status on the server, and offers a way back when nothing matches", async () => {
    serve({
      [LIST]: { codes: [menu, flyer], next_cursor: null },
      [`${LIST}&status=paused`]: { codes: [flyer], next_cursor: null },
      [`${LIST}&q=nothing&status=paused`]: { codes: [], next_cursor: null },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    await waitFor(() => expect(screen.queryByRole("article", { name: "Menu" })).toBeNull());
    expect(screen.getByRole("article", { name: "Flyer" })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: l.search }), { target: { value: "nothing" } });
    expect(await screen.findByRole("heading", { name: l.noResults })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: l.clearFilters }));
    expect(await screen.findByRole("article", { name: "Menu" })).toBeTruthy();
    expect((screen.getByRole("searchbox", { name: l.search }) as HTMLInputElement).value).toBe("");
  });

  it("asks the server for the most scanned codes, in its order", async () => {
    serve({
      [LIST]: { codes: [menu, wifi], next_cursor: null },
      [`${LIST}&sort=scans`]: { codes: [code({ id: "c2", name: "Wi-Fi", scans_total: 9 }), code({ scans_total: 2 })], next_cursor: null },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.sort }), { target: { value: "scans" } });
    await waitFor(() => expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Wi-Fi", "Menu"]));
  });

  it("applies a cleared search at once, and gives focus back to the search box", async () => {
    serve({
      [LIST]: { codes: [menu, flyer], next_cursor: null },
      [`${LIST}&q=nothing`]: { codes: [], next_cursor: null },
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("searchbox", { name: l.search }), { target: { value: "nothing" } });
    expect(await screen.findByRole("heading", { name: l.noResults })).toBeTruthy();
    const before = request.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: l.clearFilters }));
    expect(await screen.findByRole("article", { name: "Menu" })).toBeTruthy();
    // The plain list, straight away: no request for the old search with the cleared filters.
    expect(request.mock.calls.slice(before).map(([p]) => p)).toEqual([LIST]);
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: l.search }));
  });

  it("drops a slow answer to an older query", async () => {
    let releaseOld: (v: unknown) => void = () => {};
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      if (path === LIST) return { codes: [menu], next_cursor: null };
      if (path === `${LIST}&sort=name`) return new Promise((r) => (releaseOld = r));
      if (path === `${LIST}&sort=oldest`) return { codes: [flyer], next_cursor: null };
      throw new Error(`unexpected ${path}`);
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    const sort = screen.getByRole("combobox", { name: l.sort });
    fireEvent.change(sort, { target: { value: "name" } });
    fireEvent.change(sort, { target: { value: "oldest" } });
    expect(await screen.findByRole("article", { name: "Flyer" })).toBeTruthy();
    await act(async () => releaseOld({ codes: [wifi], next_cursor: null }));
    expect(screen.queryByRole("article", { name: "Wi-Fi" })).toBeNull();
    expect(screen.getByRole("article", { name: "Flyer" })).toBeTruthy();
  });

  it("keeps the list and the toolbar when new results fail, with a retry", async () => {
    let fail = true;
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      if (path === LIST) return { codes: [menu], next_cursor: null };
      if (path === `${LIST}&status=paused`) {
        if (fail) throw new ApiError(503, "busy", "busy");
        return { codes: [flyer], next_cursor: null };
      }
      throw new Error(`unexpected ${path}`);
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "paused" } });
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: l.search })).toBeTruthy();
    fail = false;
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.retry })));
    expect(await screen.findByRole("article", { name: "Flyer" })).toBeTruthy();
  });

  it("announces how many codes match a search", async () => {
    serve({ [LIST]: { codes: [menu, wifi], next_cursor: null }, [`${LIST}&q=menu`]: { codes: [menu], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("searchbox", { name: l.search }), { target: { value: "menu" } });
    await waitFor(() =>
      expect(screen.getAllByRole("status").some((s) => s.textContent === plural("en", l.matches, 1))).toBe(true),
    );
  });

  it("takes no action on codes about to be replaced", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      if (path === LIST) return { codes: [menu], next_cursor: null };
      return new Promise(() => {});
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.sort }), { target: { value: "name" } });
    const list = await screen.findByRole("list", { busy: true });
    expect(list.hasAttribute("inert")).toBe(true);
  });

  it("keeps the current codes on screen, marked busy, while new results load", async () => {
    let release: (v: unknown) => void = () => {};
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      if (path === LIST) return { codes: [menu], next_cursor: null };
      return new Promise((r) => (release = r));
    });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.sort }), { target: { value: "name" } });
    expect(await screen.findByRole("list", { busy: true })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Menu" })).toBeTruthy();
    await act(async () => release({ codes: [wifi], next_cursor: null }));
    expect(await screen.findByRole("article", { name: "Wi-Fi" })).toBeTruthy();
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
  it("pauses the selection in one bulk request and reports the codes that did not change", async () => {
    serve({ [LIST]: { codes: [menu, wifi], next_cursor: null } }, undefined, () => [
      { id: "c1", result: "ok", code: { ...menu, status: "paused" } },
      { id: "c2", result: "locked" },
    ]);
    show();
    await screen.findByRole("article", { name: "Menu" });
    const all = screen.getByRole("checkbox", { name: l.selectAll }) as HTMLInputElement;
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }));
    expect(all.indeterminate).toBe(true);
    fireEvent.click(all);
    expect(screen.getByText(format(l.selected, { count: 2 }))).toBeTruthy();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.pause })));
    expect(bulkCalls()).toEqual([{ action: "pause", ids: ["c1", "c2"] }]);
    expect(within(card("Menu")).getByText(t.status.paused)).toBeTruthy();
    expect(screen.getByText(plural("en", l.pausedMany, 1))).toBeTruthy();
    expect(screen.getByText(plural("en", l.failed, 1))).toBeTruthy();
    // The code that did not change stays selected, so "try again" is one click.
    expect(screen.getByText(format(l.selected, { count: 1 }))).toBeTruthy();
  });

  it("counts a code missing from the answer as not changed, and drops codes deleted elsewhere", async () => {
    const poster = code({ id: "c3", short_code: "Fl1yEr00", name: "Flyer" }); // active, so Pause sends it
    serve({ [LIST]: { codes: [menu, wifi, poster], next_cursor: null } }, undefined, () => [
      { id: "c1", result: "ok", code: { ...menu, status: "paused" } },
      { id: "c2", result: "not_found" },
      { id: "zz", result: "ok" },
    ]);
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Wi-Fi" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Flyer" }) }));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.pause })));
    expect(bulkCalls()).toEqual([{ action: "pause", ids: ["c1", "c2", "c3"] }]);
    // Wi-Fi is gone; Flyer got no answer and stays selected as not changed.
    expect(screen.queryByRole("article", { name: "Wi-Fi" })).toBeNull();
    expect(screen.getByText(plural("en", l.failed, 1))).toBeTruthy();
    expect(screen.getByText(format(l.selected, { count: 1 }))).toBeTruthy();
  });

  it("removes a code that left the filtered status from the list", async () => {
    serve(
      { [LIST]: { codes: [menu], next_cursor: null }, [`${LIST}&status=active`]: { codes: [menu, wifi], next_cursor: null } },
      undefined,
      () => [{ id: "c1", result: "ok", code: { ...menu, status: "paused" } }],
    );
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.change(screen.getByRole("combobox", { name: l.statusFilter }), { target: { value: "active" } });
    await screen.findByRole("article", { name: "Wi-Fi" });
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.pause })));
    expect(screen.queryByRole("article", { name: "Menu" })).toBeNull();
    expect(screen.getByRole("article", { name: "Wi-Fi" })).toBeTruthy();
  });

  it("says why a resume was refused when the email is not verified", async () => {
    serve({ [LIST]: { codes: [flyer], next_cursor: null } }, undefined, (b) => b.ids.map((id) => ({ id, result: "email_not_verified" as const })));
    show();
    await screen.findByRole("article", { name: "Flyer" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.resume })));
    expect(screen.getByText(t.errors.verifyFirst)).toBeTruthy();
  });

  // These render a hundred cards and more: a second or so here, near five on a CI runner.
  it("sends at most 100 codes per bulk request", { timeout: 20_000 }, async () => {
    const many = Array.from({ length: 150 }, (_, i) => code({ id: `id${i}`, name: `Code ${i}` }));
    serve({ [LIST]: { codes: many, next_cursor: null } }, undefined, allOk(many));
    show();
    await screen.findByRole("article", { name: "Code 0" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.pause })));
    expect(bulkCalls().map((b) => b.ids.length)).toEqual([100, 50]);
    expect(screen.getByText(plural("en", l.pausedMany, 150))).toBeTruthy();
  });

  // These render a hundred cards and more: a second or so here, near five on a CI runner.
  it("stops at the bulk limit, says when to retry, and keeps the rest selected", { timeout: 20_000 }, async () => {
    const many = Array.from({ length: 150 }, (_, i) => code({ id: `id${i}`, name: `Code ${i}` }));
    let calls = 0;
    serve({ [LIST]: { codes: many, next_cursor: null } }, undefined, (b) => {
      if (++calls === 2) throw new ApiError(429, "rate_limited", "slow down", undefined, 42);
      return allOk(many)(b);
    });
    show();
    await screen.findByRole("article", { name: "Code 0" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: l.pause })));
    expect(screen.getByText(format(l.bulkRateLimited, { seconds: 42 }))).toBeTruthy();
    expect(screen.getByText(plural("en", l.pausedMany, 100))).toBeTruthy();
    expect(screen.getByText(format(l.selected, { count: 50 }))).toBeTruthy();
  });

  it("deletes the selected codes in one bulk request after one confirmation", async () => {
    serve({ [LIST]: { codes: [menu, wifi, flyer], next_cursor: null } }, undefined, (b) =>
      b.ids.map((id) => ({ id, result: id === "c3" ? ("not_found" as const) : ("ok" as const) })),
    );
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }));
    fireEvent.click(screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Flyer" }) }));
    fireEvent.click(screen.getByRole("button", { name: l.delete }));
    const dialog = screen.getByRole("dialog", { name: plural("en", l.deleteManyTitle, 2) });
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: l.deleteConfirm })));
    expect(bulkCalls()).toEqual([{ action: "delete", ids: ["c1", "c3"] }]);
    expect(requestVoid).not.toHaveBeenCalled();
    // A code already gone counts as deleted.
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Wi-Fi"]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("retitles the dialog for the codes left after a partial failure", async () => {
    serve({ [LIST]: { codes: [menu, wifi, flyer], next_cursor: null } }, undefined, (b) =>
      b.ids.map((id) => ({ id, result: id === "c3" ? ("locked" as const) : ("ok" as const) })),
    );
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    fireEvent.click(screen.getByRole("button", { name: l.delete }));
    await act(async () => void fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: l.deleteConfirm })));
    const dialog = screen.getByRole("dialog", { name: format(l.deleteOneTitle, { name: "Flyer" }) });
    expect(within(dialog).getByRole("alert").textContent).toBe(plural("en", l.failed, 1));
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Flyer"]);
  });

  it("drops codes hidden by a filter from the selection, for good", async () => {
    serve({ [LIST]: { codes: [menu, flyer], next_cursor: null }, [`${LIST}&status=paused`]: { codes: [flyer], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    fireEvent.click(screen.getByRole("checkbox", { name: l.selectAll }));
    const status = screen.getByRole("combobox", { name: l.statusFilter });
    fireEvent.change(status, { target: { value: "paused" } });
    await waitFor(() => expect(screen.getByText(format(l.selected, { count: 1 }))).toBeTruthy());
    // Back to every status: Menu was dropped, it does not come back selected.
    fireEvent.change(status, { target: { value: "all" } });
    await screen.findByRole("article", { name: "Menu" });
    expect((screen.getByRole("checkbox", { name: format(l.selectCode, { name: "Menu" }) }) as HTMLInputElement).checked).toBe(false);
  });
});

describe("CodesList short link from the row menu", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  });

  it("edits a code's short link in a dialog and shows the new link on its card", async () => {
    serve({ [LIST]: { codes: [code({})], next_cursor: null } }, (_id, body) => ({ ...code({}), ...(body as object), short_url: "http://localhost:8180/my-shop" }));
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    await pick(t.pages.editShortLink);
    const dialog = screen.getByRole("dialog", { name: t.pages.editShortLink });
    fireEvent.change(within(dialog).getByRole("textbox", { name: t.slugLabel }), { target: { value: "my-shop" } });
    await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: t.save })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(within(card("Menu")).getByText("localhost:8180/my-shop")).toBeTruthy();
    expect(screen.getByText(t.linkSaved)).toBeTruthy();
  });

  it("offers no short link change for a locked code", async () => {
    serve({ [LIST]: { codes: [code({ status: "locked" })], next_cursor: null } });
    show();
    await screen.findByRole("article", { name: "Menu" });
    openMenu("Menu");
    expect(screen.getByRole("menuitem", { name: t.pages.editShortLink }).getAttribute("aria-disabled")).toBe("true");
  });
});
