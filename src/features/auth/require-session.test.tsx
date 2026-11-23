// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, sessionApi } from "@/lib/api";
import { en } from "@/i18n/messages/en";
import { RequireSession, useUser } from "./require-session";

function Name() {
  return <p>hello {useUser().email}</p>;
}

const user = {
  id: "1",
  email: "a@example.com",
  display_name: "",
  role: "user" as const,
  email_verified: true,
  created_at: "2026-01-01T00:00:00Z",
};

let replace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  replace = vi.fn();
  vi.stubGlobal("location", { pathname: "/app/codes", search: "?tab=stats", replace });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderGuard() {
  return render(
    <StrictMode>
      <RequireSession messages={en.session}>
        <Name />
      </RequireSession>
    </StrictMode>,
  );
}

describe("RequireSession", () => {
  it("renders children with the user once loaded", async () => {
    vi.spyOn(sessionApi, "request").mockResolvedValue({ user });
    renderGuard();
    expect(await screen.findByText("hello a@example.com")).toBeTruthy();
  });

  it("sends logged-out visitors to login with an encoded return_to", async () => {
    vi.spyOn(sessionApi, "request").mockRejectedValue(new ApiError(401, "unauthenticated", "no"));
    renderGuard();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/login?return_to=%2Fapp%2Fcodes%3Ftab%3Dstats");
    expect(screen.queryByText(/hello/)).toBeNull();
  });

  it("keeps the language of the page in the login redirect", async () => {
    vi.stubGlobal("location", { pathname: "/vi/app", search: "", replace });
    vi.spyOn(sessionApi, "request").mockRejectedValue(new ApiError(401, "unauthenticated", "no"));
    renderGuard();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/vi/login?return_to=%2Fvi%2Fapp"));
  });

  it("ignores the request aborted by the strict-mode remount", async () => {
    const request = vi.spyOn(sessionApi, "request").mockImplementation(
      (_path, opts) =>
        new Promise((resolve, reject) => {
          opts?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          setTimeout(() => resolve({ user }), 0);
        }),
    );
    renderGuard();
    expect(await screen.findByText("hello a@example.com")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers a retry after other failures", async () => {
    const request = vi
      .spyOn(sessionApi, "request")
      .mockRejectedValueOnce(new ApiError(0, "network_error", "down"))
      .mockRejectedValueOnce(new ApiError(0, "network_error", "down"))
      .mockResolvedValue({ user });
    renderGuard();
    expect(await screen.findByRole("alert")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect(await screen.findByText("hello a@example.com")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(request.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
