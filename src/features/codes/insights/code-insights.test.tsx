// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RequireSession } from "@/features/auth/require-session";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import type { CodeStats, DynamicCode } from "@/lib/api/types";
import { EMPTY_CAMPAIGN } from "../campaign/rules";
import { clearThumbnailCache } from "../list/code-thumbnail";
import { CodeInsights } from "./code-insights";
import { presetRange } from "./range";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "c1" }) }));

const t = en.codes;
const i = t.insights;
const me = {
  user: { id: "u1", email: "an@example.com", display_name: "An", role: "user" as const, email_verified: true, has_password: true, created_at: "2026-11-01T10:00:00Z" },
  workspaces: [{ id: "w1", name: "Personal", personal: true, role: "owner" }],
};
const code: DynamicCode = {
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
};
const CODE = "/v1/workspaces/w1/codes/c1";
const statsPath = (r: { from: string; to: string }) => `${CODE}/stats?from=${r.from}&to=${r.to}`;
const stats = (over: Partial<CodeStats> = {}): CodeStats => ({
  from: "2026-10-30",
  to: "2026-11-03",
  scans: 10,
  daily: [
    { day: "2026-10-30", scans: 1, unique_scans: 1 },
    { day: "2026-10-31", scans: 2, unique_scans: 1 },
    { day: "2026-11-01", scans: 3, unique_scans: 2 },
    { day: "2026-11-02", scans: 4, unique_scans: 4 },
    { day: "2026-11-03", scans: 0, unique_scans: 0 },
  ],
  countries: [{ value: "VN", scans: 7 }],
  devices: [{ value: "mobile", scans: 10 }],
  os: [
    { value: "ios", scans: 6 },
    { value: "android", scans: 4 },
  ],
  browsers: [{ value: "safari", scans: 6 }],
  ...over,
});

let request: MockInstance<typeof sessionApi.request>;
const serve = (answer: (path: string) => unknown = () => stats()) =>
  request.mockImplementation(async (path) => {
    if (path === "/v1/me") return me;
    if (path === CODE) return { code };
    if (path.startsWith(`${CODE}/stats`)) return answer(path);
    throw new Error(`unexpected ${path}`);
  });
const statsCalls = () => request.mock.calls.map(([path]) => path).filter((path) => path.includes("/stats"));
const show = () =>
  render(
    <RequireSession messages={en.session}>
      <CodeInsights t={t} locale="en" />
    </RequireSession>,
  );
const select = (name: string) => screen.getByRole("combobox", { name }) as HTMLSelectElement;
const tile = (name: string) => within(screen.getByRole("group", { name })).getByText(/^[\d,]+$/).textContent;

beforeEach(() => {
  request = vi.spyOn(sessionApi, "request");
  vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  vi.stubGlobal("location", { assign: vi.fn(), replace: vi.fn(), pathname: "/app/codes/c1/insights", search: "", hash: "" });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  clearThumbnailCache();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CodeInsights", () => {
  it("shows the code, its totals for the last 30 days and where the scans came from", async () => {
    serve();
    show();
    expect(await screen.findByRole("heading", { name: "Menu", level: 1 })).toBeTruthy();
    await waitFor(() => expect(statsCalls()).toEqual([statsPath(presetRange(30))]));
    expect(await screen.findByRole("group", { name: i.totalScans })).toBeTruthy();
    expect(tile(i.totalScans)).toBe("10");
    expect(tile(i.uniqueScans)).toBe("8");
    expect(screen.getByText("localhost:8180/Ab3dE5gH")).toBeTruthy();
    expect(screen.getByRole("link", { name: i.edit }).getAttribute("href")).toBe("/app/codes/c1");
    const list = (name: string) => within(screen.getByRole("region", { name })).getAllByRole("listitem").map((li) => li.textContent);
    expect(list(i.os)).toEqual(["iOS6", "Android4"]);
    expect(list(t.countries)).toEqual(["Vietnam7", `${t.unknown}3`]); // what the API left out is "Unknown"
    expect(list(t.devices)).toEqual([`${t.deviceNames.mobile}10`]);
    expect(list(i.browsers)).toEqual(["Safari6", `${t.unknown}4`]);
  });

  it("asks the API again for another period", async () => {
    serve();
    show();
    await screen.findByRole("group", { name: i.totalScans });
    fireEvent.change(select(i.range), { target: { value: "7" } });
    await waitFor(() => expect(statsCalls()).toEqual([statsPath(presetRange(30)), statsPath(presetRange(7))]));
  });

  it("takes a custom period once it is one the API accepts", async () => {
    serve();
    show();
    await screen.findByRole("group", { name: i.totalScans });
    fireEvent.change(select(i.range), { target: { value: "custom" } });
    const from = screen.getByLabelText(i.from) as HTMLInputElement;
    const to = screen.getByLabelText(i.to) as HTMLInputElement;
    expect([from.value, to.value]).toEqual([presetRange(30).from, presetRange(30).to]); // starts from what is shown
    fireEvent.change(from, { target: { value: "2031-01-01" } });
    expect(screen.getByRole("alert").textContent).toContain("366");
    expect(statsCalls()).toHaveLength(1);
    fireEvent.change(from, { target: { value: "2026-10-01" } });
    fireEvent.change(to, { target: { value: "2026-10-31" } });
    await waitFor(() => expect(statsCalls().at(-1)).toBe(statsPath({ from: "2026-10-01", to: "2026-10-31" })));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("groups the same days by week and by month, in the table behind the chart", async () => {
    serve();
    show();
    await screen.findByRole("group", { name: i.totalScans });
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.tableToggle })));
    const rows = () =>
      within(screen.getByRole("table"))
        .getAllByRole("row")
        .slice(1)
        .map((r) => r.textContent);
    expect(rows()).toHaveLength(5);
    fireEvent.change(select(i.bucket), { target: { value: "week" } });
    expect(rows()).toEqual(["Oct 30 – Nov 164", "Nov 2 – Nov 344"]);
    fireEvent.change(select(i.bucket), { target: { value: "month" } });
    expect(rows()).toEqual(["Oct 30 – Oct 3132", "Nov 1 – Nov 376"]);
    expect(statsCalls()).toHaveLength(1); // grouping asks the API for nothing
  });

  it("downloads the periods shown as a CSV file named after the code and the period", async () => {
    serve();
    show();
    await screen.findByRole("group", { name: i.totalScans });
    const saved: { name: string; text: string }[] = [];
    const blobs: Blob[] = [];
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockImplementation((b: Blob) => (blobs.push(b), "blob:csv"));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, text: this.href });
    });
    fireEvent.change(select(i.bucket), { target: { value: "month" } });
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: i.downloadCsv })));
    expect(saved).toEqual([{ name: `Ab3dE5gH-${presetRange(30).from}-${presetRange(30).to}.csv`, text: "blob:csv" }]);
    // jsdom's Blob has no text(): read it the old way.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      // The code's image is a blob too, and may arrive after the click: take the CSV one.
      reader.readAsText(blobs.find((b) => b.type.startsWith("text/csv"))!);
    });
    expect(text).toBe(
      `"${i.from}","${i.to}","${t.scansColumn}","${t.uniqueColumn}"\r\n"2026-10-30","2026-10-31","3","2"\r\n"2026-11-01","2026-11-03","7","6"\r\n`,
    );
  });

  it("opens a long custom period grouped by week, and keeps the last figures on screen while the next load", async () => {
    let release: (v: unknown) => void = () => {};
    serve((path) => (path.includes("from=2026-01-01") ? new Promise((resolve) => (release = resolve)) : stats()));
    show();
    await screen.findByRole("group", { name: i.totalScans });
    fireEvent.change(select(i.range), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText(i.from), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText(i.to), { target: { value: "2026-10-31" } });
    await waitFor(() => expect(statsCalls().at(-1)).toBe(statsPath({ from: "2026-01-01", to: "2026-10-31" })));
    expect(select(i.bucket).value).toBe("week"); // a bar per day would be a hairline
    expect(tile(i.totalScans)).toBe("10"); // still the last answer, marked busy
    const said = () => screen.getAllByRole("status").map((el) => el.textContent); // the copy button has a status of its own
    expect(said()).toContain(i.loading);
    await act(async () => release(stats({ scans: 4, daily: [{ day: "2026-01-01", scans: 4, unique_scans: 3 }] })));
    expect(tile(i.totalScans)).toBe("4");
    expect(said().some((text) => text?.includes(`${i.totalScans} 4`))).toBe(true);
  });

  it("does not complain about a date that is still being typed", async () => {
    serve();
    show();
    await screen.findByRole("group", { name: i.totalScans });
    fireEvent.change(select(i.range), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText(i.from), { target: { value: "" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(statsCalls()).toHaveLength(1);
  });

  it("says so when the period has no scans, and offers no export of nothing", async () => {
    serve(() => stats({ scans: 0, daily: [{ day: "2026-11-01", scans: 0, unique_scans: 0 }], countries: [], devices: [], os: [], browsers: [] }));
    show();
    expect(await screen.findByText(i.emptyTitle)).toBeTruthy();
    expect(tile(i.totalScans)).toBe("0");
    expect(screen.queryByRole("button", { name: i.downloadCsv })).toBeNull();
    expect(screen.queryByRole("region", { name: i.os })).toBeNull();
  });

  it("keeps the code on the page and offers a retry when the scans cannot be loaded", async () => {
    let fail = true;
    serve(() => {
      if (fail) throw new ApiError(503, "busy", "busy");
      return stats();
    });
    show();
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Menu", level: 1 })).toBeTruthy();
    fail = false;
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: t.retry })));
    expect(await screen.findByRole("group", { name: i.totalScans })).toBeTruthy();
  });

  it("says when the code does not exist", async () => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me") return me;
      throw new ApiError(404, "not_found", "nope");
    });
    show();
    expect(await screen.findByText(t.notFound)).toBeTruthy();
  });
});
