// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { File as NodeFile } from "node:buffer";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import { config } from "@/lib/config";
import type { QrLogo } from "@/lib/qr/types";
import { LogoUpload, type LogoValue } from "./logo-upload";

const t = en.uploads;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const upload = (over: Partial<{ width: number; height: number }> = {}) => ({
  id: "00000000-0000-4000-8000-000000000001", kind: "image", content_type: "image/png", size_bytes: 11,
  width: 256, height: 256, url: `${config.filesBaseUrl}/w/abc.png`, created_at: "2026-11-26T00:00:00Z", ...over,
});
const seen: { value: LogoValue } = { value: { logoUploadId: "" } };

function Harness({ start = { logoUploadId: "" } as LogoValue }) {
  const [value, setValue] = useState<LogoValue>(start);
  return (
    <LogoUpload
      t={t}
      workspaceId="w1"
      value={value}
      onChange={(next) => {
        seen.value = next;
        setValue(next);
      }}
    />
  );
}

// jsdom's File has no arrayBuffer(); Node's does, as browsers do.
const choose = (bytes: Uint8Array, name = "logo.png") =>
  fireEvent.change(screen.getByLabelText(t.choose), { target: { files: [new NodeFile([Buffer.from(bytes)], name)] } });

beforeEach(() => {
  seen.value = { logoUploadId: "" };
  vi.stubGlobal("fetch", vi.fn(async () => new Response(png, { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LogoUpload", () => {
  it("uploads the file and keeps its id and pixels for the preview", async () => {
    const post = vi.spyOn(sessionApi, "request").mockResolvedValue({ upload: upload() });
    render(<Harness />);
    choose(png);
    await waitFor(() => expect(seen.value.logoUploadId).toBe("00000000-0000-4000-8000-000000000001"));
    const [path, opts] = post.mock.calls[0];
    expect(path).toBe("/v1/workspaces/w1/uploads");
    expect(opts?.body).toBeInstanceOf(FormData);
    await waitFor(() => expect((seen.value.logo as QrLogo | undefined)?.base64).toBe(Buffer.from(png).toString("base64")));
    expect(screen.getByRole("button", { name: t.remove })).toBeTruthy();
  });

  it("refuses other files before uploading, and says why the API refused one", async () => {
    const post = vi.spyOn(sessionApi, "request");
    render(<Harness />);
    choose(new TextEncoder().encode("<html>"), "x.png");
    expect(await screen.findByText(t.errors.type)).toBeTruthy();
    expect(post).not.toHaveBeenCalled();

    post.mockRejectedValueOnce(new ApiError(403, "storage_quota_exceeded", "full"));
    choose(png);
    expect(await screen.findByText(t.errors.quota)).toBeTruthy();
  });

  it("refuses an image too large to be a logo", async () => {
    vi.spyOn(sessionApi, "request").mockResolvedValue({ upload: upload({ width: 2048 }) });
    render(<Harness />);
    choose(png);
    expect(await screen.findByText(t.errors.dimensions)).toBeTruthy();
    expect(seen.value.logoUploadId).toBe("");
  });

  it("loads a saved logo's pixels, and removes it", async () => {
    vi.spyOn(sessionApi, "request").mockResolvedValue({ upload: upload() });
    render(<Harness start={{ logoUploadId: "00000000-0000-4000-8000-000000000001" }} />);
    await waitFor(() => expect(seen.value.logo).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: t.remove }));
    expect(seen.value).toEqual({ logoUploadId: "", logo: undefined });
  });
});

describe("LogoUpload after review", () => {
  it("removes an upload it cannot use, so it does not take storage", async () => {
    const post = vi.spyOn(sessionApi, "request").mockResolvedValue({ upload: upload({ width: 4000 }) });
    const del = vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
    render(<Harness />);
    choose(png);
    expect(await screen.findByText(t.errors.dimensions)).toBeTruthy();
    expect(post).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith("/v1/workspaces/w1/uploads/00000000-0000-4000-8000-000000000001", { method: "DELETE" });
  });

  it("never fetches a link outside the files host", async () => {
    vi.spyOn(sessionApi, "request").mockResolvedValue({ upload: { ...upload(), url: "https://evil.example/x.png" } });
    vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
    render(<Harness />);
    choose(png);
    expect(await screen.findByText(t.errors.failed)).toBeTruthy();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("says when a saved logo cannot be shown", async () => {
    vi.spyOn(sessionApi, "request").mockRejectedValue(new ApiError(404, "not_found", "gone"));
    render(<Harness start={{ logoUploadId: "00000000-0000-4000-8000-000000000001" }} />);
    expect(await screen.findByText(t.errors.missing)).toBeTruthy();
  });

  it("moves focus to what replaced the control and announces the upload", async () => {
    vi.spyOn(sessionApi, "request").mockResolvedValue({ upload: upload() });
    render(<Harness />);
    choose(png);
    const remove = await screen.findByRole("button", { name: t.remove });
    await waitFor(() => expect(document.activeElement).toBe(remove));
    expect(screen.getByRole("status").textContent).toBe(t.uploaded);
    fireEvent.click(remove);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(t.choose)));
  });
});
