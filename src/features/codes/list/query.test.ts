import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, isDefaultQuery, listParams } from "./query";

describe("listParams", () => {
  it("sends nothing for the default list", () => {
    expect(listParams(DEFAULT_QUERY)).toEqual({});
  });

  it("sends the trimmed search, the status and a non-default order", () => {
    expect(listParams({ search: "  thực đơn ", status: "paused", sort: "scans" })).toEqual({ q: "thực đơn", status: "paused", sort: "scans" });
    expect(listParams({ ...DEFAULT_QUERY, sort: "newest" })).toEqual({});
  });

  it("keeps the search within what the API takes: 10 distinct words, 100 characters", () => {
    const eleven = "a b c d e f g h i j k";
    expect(listParams({ ...DEFAULT_QUERY, search: eleven }).q).toBe("a b c d e f g h i j");
    expect(listParams({ ...DEFAULT_QUERY, search: "menu  MENU   cafe" }).q).toBe("menu cafe");
    const long = "ệ".repeat(150);
    expect([...listParams({ ...DEFAULT_QUERY, search: long }).q!]).toHaveLength(100);
  });

  it("leaves out a blank search", () => {
    expect(listParams({ ...DEFAULT_QUERY, search: "   " })).toEqual({});
  });
});

describe("isDefaultQuery", () => {
  it("is true while no filter narrows the list (the order does not count)", () => {
    expect(isDefaultQuery({ ...DEFAULT_QUERY, sort: "name" })).toBe(true);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, search: " " })).toBe(true);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, status: "active" })).toBe(false);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, search: "menu" })).toBe(false);
  });
});
