import { afterEach, describe, expect, it, vi } from "vitest";
import { publicApi, sessionApi } from "@/lib/api";
import { getPageTypes, previewPage, sampleUrl } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("pages api", () => {
  it("reads the page types", async () => {
    const request = vi.spyOn(publicApi, "request").mockResolvedValue({ types: [{ name: "links", fields: [] }] });
    expect(await getPageTypes()).toEqual([{ name: "links", fields: [] }]);
    expect(request).toHaveBeenCalledWith("/v1/page-types", { signal: undefined });
  });

  it("previews a page through the session and answers its HTML", async () => {
    const blob = vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["<h1>Hi</h1>"], { type: "text/html" }));
    const page = { type: "links", theme: { primary: "#0f766e", button: "#0f766e" }, content: { title: "Hi" } };
    expect(await previewPage("w 1", page)).toBe("<h1>Hi</h1>");
    expect(blob).toHaveBeenCalledWith("/v1/workspaces/w%201/pages/preview", { method: "POST", body: { page }, signal: undefined }, "text/html");
  });

  it("points at a type's sample on the API", () => {
    expect(sampleUrl("menu", "vi")).toMatch(/^https?:\/\/[^/]+\/v1\/page-types\/menu\/sample\?lang=vi$/);
  });
});
