// @vitest-environment jsdom
import { act, cleanup, render as rtlRender } from "@testing-library/react";
import { Activity, useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { ApiError, publicApi } from "@/lib/api";
import type { RenderRequest } from "@/lib/qr/render-request";
import { useRenderPreview, type PreviewState } from "./use-render";

const req = (path: string): RenderRequest => ({ method: "GET", path });

let blob: MockInstance<typeof publicApi.requestBlob>;
let created: string[];
let revoked: string[];

beforeEach(() => {
  vi.useFakeTimers();
  created = [];
  revoked = [];
  let n = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => {
        const href = `blob:${++n}`;
        created.push(href);
        return href;
      }),
      revokeObjectURL: vi.fn((href: string) => revoked.push(href)),
    }),
  );
  blob = vi.spyOn(publicApi, "requestBlob").mockImplementation(async (path) => new Blob([path]));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Test probes hand hook state out through a mutable box (a test-only side channel).
const box: { latest: PreviewState; setMode: (m: "visible" | "hidden") => void } = {
  latest: { src: null, pending: false, error: null },
  setMode: () => {},
};
function Probe({ path, scope = "url" }: { path: string | null; scope?: string }) {
  const state = useRenderPreview(path ? req(path) : null, path, scope);
  useEffect(() => {
    box.latest = state;
  });
  return null;
}

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe("useRenderPreview", () => {
  it("waits for a pause in changes and renders once", async () => {
    const { rerender } = rtlRender(<Probe path="/a" />);
    await tick(200);
    rerender(<Probe path="/ab" />);
    await tick(200);
    rerender(<Probe path="/abc" />);
    expect(box.latest.pending).toBe(true);
    await tick(500);
    expect(blob).toHaveBeenCalledTimes(1);
    expect(blob.mock.calls[0][0]).toBe("/abc");
    expect(box.latest).toEqual({ src: "blob:1", pending: false, error: null });
  });

  it("keeps the old image while the next one loads and frees it afterwards", async () => {
    const { rerender } = rtlRender(<Probe path="/a" />);
    await tick(500);
    rerender(<Probe path="/b" />);
    expect(box.latest.src).toBe("blob:1");
    expect(box.latest.pending).toBe(true);
    await tick(500);
    expect(box.latest.src).toBe("blob:2");
    expect(revoked).toContain("blob:1");
  });

  it("never shows another type's image", async () => {
    const { rerender } = rtlRender(<Probe path="/a" scope="url" />);
    await tick(500);
    expect(box.latest.src).toBe("blob:1");
    rerender(<Probe path="/w" scope="wifi" />);
    expect(box.latest.src).toBeNull();
    expect(box.latest.pending).toBe(true);
  });

  it("reports the error of the latest request", async () => {
    blob.mockRejectedValueOnce(new ApiError(422, "validation_error", "x", "url"));
    rtlRender(<Probe path="/bad" />);
    await tick(500);
    expect(box.latest.error?.field).toBe("url");
    expect(box.latest.pending).toBe(false);
  });

  it("returns nothing to show without a request", () => {
    rtlRender(<Probe path={null} />);
    expect(box.latest).toEqual({ src: null, pending: false, error: null });
    expect(blob).not.toHaveBeenCalled();
  });

  it("recreates the image URL after being hidden by <Activity>", async () => {
    function Host() {
      const [mode, set] = useState<"visible" | "hidden">("visible");
      useEffect(() => {
        box.setMode = set;
      }, []);
      return (
        <Activity mode={mode}>
          <Probe path="/a" />
        </Activity>
      );
    }
    rtlRender(<Host />);
    await tick(500);
    expect(box.latest.src).toBe("blob:1");
    await act(async () => box.setMode("hidden"));
    expect(revoked).toContain("blob:1");
    await act(async () => box.setMode("visible"));
    await tick(0);
    expect(box.latest.src).toBe("blob:2");
    expect(revoked).not.toContain("blob:2");
  });
});
