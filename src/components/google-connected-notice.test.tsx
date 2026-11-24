// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleConnectedNotice } from "./google-connected-notice";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
});

describe("GoogleConnectedNotice", () => {
  it("says Google is connected once, and takes the marker out of the address", () => {
    window.history.replaceState(null, "", "/vi/app?tab=1&google=connected#top");
    render(<GoogleConnectedNotice message="Connected" dismiss="Dismiss" />);
    expect(screen.getByRole("status").textContent).toContain("Connected");
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/vi/app?tab=1#top");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("hides itself after a while", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/app?google=connected");
    render(<GoogleConnectedNotice message="Connected" dismiss="Dismiss" />);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows nothing without the marker", () => {
    window.history.replaceState(null, "", "/app?google=other");
    render(<GoogleConnectedNotice message="Connected" dismiss="Dismiss" />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
