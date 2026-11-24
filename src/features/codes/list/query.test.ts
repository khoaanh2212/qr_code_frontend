import { describe, expect, it } from "vitest";
import type { DynamicCode } from "@/lib/api/types";
import { applyQuery, DEFAULT_QUERY, isDefaultQuery, matchesSearch, needsAllPages, normalizeSearch } from "./query";

const make = (over: Partial<DynamicCode>): DynamicCode => ({
  id: "c",
  short_code: "Ab3dE5gH",
  short_url: "https://qr.example/Ab3dE5gH",
  name: "",
  target_url: "https://example.com/",
  design: {},
  status: "active",
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  ...over,
});

const menu = make({ id: "a", name: "Thực đơn quán", target_url: "https://cafe.example/menu", created_at: "2026-11-21T10:00:00Z" });
const wifi = make({ id: "b", name: "Wi-Fi khách", short_code: "Zz9yX8wV", short_url: "https://qr.example/Zz9yX8wV", status: "paused", created_at: "2026-11-23T10:00:00Z" });
const blank = make({ id: "c", name: "", created_at: "2026-11-22T10:00:00Z" });
const all = [wifi, blank, menu]; // server order: newest first

describe("normalizeSearch", () => {
  it("ignores case, Vietnamese diacritics and đ", () => {
    expect(normalizeSearch("  Thực ĐƠN  ")).toBe("thuc don");
  });
});

describe("matchesSearch", () => {
  it("matches every word against the name, short link and destination", () => {
    expect(matchesSearch(menu, "thuc don")).toBe(true);
    expect(matchesSearch(menu, "don cafe")).toBe(true);
    expect(matchesSearch(menu, "don wifi")).toBe(false);
  });

  it("finds a code from its pasted short link or destination URL", () => {
    expect(matchesSearch(wifi, "https://qr.example/Zz9yX8wV")).toBe(true);
    expect(matchesSearch(wifi, "zz9yx8wv")).toBe(true);
    expect(matchesSearch(menu, "https://cafe.example/menu/")).toBe(true);
  });

  it("strips a URL inside a longer search, and ignores a half-typed scheme", () => {
    expect(matchesSearch(menu, "thuc https://cafe.example/menu")).toBe(true);
    expect(matchesSearch(wifi, "https://")).toBe(true);
    expect(matchesSearch(wifi, "https:")).toBe(true);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, search: "https://" })).toBe(true);
  });

  it("folds ß and keeps non-Latin marks", () => {
    expect(normalizeSearch("Straße")).toBe("strasse");
    expect(normalizeSearch("ガ")).not.toBe(normalizeSearch("カ"));
  });

  it("matches everything for an empty search", () => {
    expect(matchesSearch(blank, "   ")).toBe(true);
  });
});

describe("applyQuery", () => {
  it("keeps the server order (newest first) by default", () => {
    expect(applyQuery(all, DEFAULT_QUERY, "en").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("filters by status and search together", () => {
    expect(applyQuery(all, { ...DEFAULT_QUERY, status: "paused" }, "en").map((c) => c.id)).toEqual(["b"]);
    expect(applyQuery(all, { ...DEFAULT_QUERY, status: "active", search: "wifi" }, "en")).toEqual([]);
  });

  it("sorts oldest first, and by name with untitled codes last", () => {
    expect(applyQuery(all, { ...DEFAULT_QUERY, sort: "oldest" }, "en").map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(applyQuery(all, { ...DEFAULT_QUERY, sort: "name" }, "vi").map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate its input", () => {
    const input = [...all];
    applyQuery(input, { ...DEFAULT_QUERY, sort: "oldest" }, "en");
    expect(input).toEqual(all);
  });
});

describe("needsAllPages / isDefaultQuery", () => {
  it("needs every page only when a filter or a non-server order is used", () => {
    expect(needsAllPages(DEFAULT_QUERY)).toBe(false);
    expect(needsAllPages({ ...DEFAULT_QUERY, search: " " })).toBe(false);
    expect(needsAllPages({ ...DEFAULT_QUERY, search: "menu" })).toBe(true);
    expect(needsAllPages({ ...DEFAULT_QUERY, status: "paused" })).toBe(true);
    expect(needsAllPages({ ...DEFAULT_QUERY, sort: "name" })).toBe(true);
  });

  it("tells whether any filter is set (sort is not a filter)", () => {
    expect(isDefaultQuery({ ...DEFAULT_QUERY, sort: "name" })).toBe(true);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, status: "active" })).toBe(false);
  });
});
