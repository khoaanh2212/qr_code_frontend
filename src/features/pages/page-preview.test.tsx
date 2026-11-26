// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError } from "@/lib/api";
import * as api from "./api";
import { PagePreview } from "./page-preview";

const t = en.pages;
const body = { type: "links", theme: { primary: "#0f766e", button: "#0f766e" }, content: { title: "Café", links: [{ label: "A", url: "https://a.example" }] } };

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });

describe("PagePreview", () => {
  it("shows the type's sample until the page can be drawn", () => {
    const preview = vi.spyOn(api, "previewPage");
    render(<PagePreview t={t} workspaceId="w1" type="menu" lang="vi" body={null} />);
    const frame = screen.getByTitle(t.sampleFrame) as HTMLIFrameElement;
    expect(frame.src).toMatch(/\/v1\/page-types\/menu\/sample\?lang=vi$/);
    expect(frame.getAttribute("sandbox")).toBe("");
    expect(screen.getByText(t.sampleNote)).toBeTruthy();
    expect(preview).not.toHaveBeenCalled();
  });

  it("draws the page itself, sandboxed, once typing pauses", async () => {
    const preview = vi.spyOn(api, "previewPage").mockResolvedValue("<h1>Café</h1>");
    const { rerender } = render(<PagePreview t={t} workspaceId="w1" type="links" lang="en" body={body} />);
    rerender(<PagePreview t={t} workspaceId="w1" type="links" lang="en" body={{ ...body, content: { ...body.content, title: "Café Lan" } }} />);
    await settle();
    expect(preview).toHaveBeenCalledTimes(1);
    expect(preview.mock.calls[0][1].content.title).toBe("Café Lan");
    const frame = screen.getByTitle(t.previewFrame) as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toBe("<h1>Café</h1>");
    expect(frame.getAttribute("sandbox")).toBe("");
  });

  it("says when the page cannot be drawn and hands a refused field back", async () => {
    vi.spyOn(api, "previewPage").mockRejectedValue(new ApiError(422, "validation_error", "bad", "page.content.links[0].url"));
    const onRefused = vi.fn();
    render(<PagePreview t={t} workspaceId="w1" type="links" lang="en" body={body} onRefused={onRefused} />);
    await settle();
    expect(screen.getByRole("status").textContent).toBe(t.previewFailed);
    expect(onRefused).toHaveBeenCalledWith("links[0].url");
  });
});
