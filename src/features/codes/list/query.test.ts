import { describe, expect, it } from "vitest";
import { ALL_FOLDERS, DEFAULT_QUERY, isDefaultQuery, listParams, NO_FOLDER } from "./query";

describe("listParams", () => {
  it("sends nothing for the default list", () => {
    expect(listParams(DEFAULT_QUERY)).toEqual({});
  });

  it("sends the trimmed search, the status and a non-default order", () => {
    expect(listParams({ ...DEFAULT_QUERY, search: "  thực đơn ", status: "paused", sort: "scans" })).toEqual({ q: "thực đơn", status: "paused", sort: "scans" });
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

describe("listParams with a folder", () => {
  it("sends the folder id, or none for codes without a folder, and nothing for all codes", () => {
    expect(listParams({ ...DEFAULT_QUERY, folder: "f1" })).toEqual({ folder: "f1" });
    expect(listParams({ ...DEFAULT_QUERY, folder: NO_FOLDER })).toEqual({ folder: "none" });
    expect(listParams({ ...DEFAULT_QUERY, folder: ALL_FOLDERS })).toEqual({});
  });

  it("combines the folder with search, status and order", () => {
    expect(listParams({ search: "menu", status: "paused", folder: "f1", sort: "name" })).toEqual({
      q: "menu",
      status: "paused",
      folder: "f1",
      sort: "name",
    });
  });

  it("counts a folder as a filter that narrows the list", () => {
    expect(isDefaultQuery({ ...DEFAULT_QUERY, folder: "f1" })).toBe(false);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, folder: NO_FOLDER })).toBe(false);
  });
});
