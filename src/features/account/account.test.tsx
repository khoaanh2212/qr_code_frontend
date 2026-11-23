// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RequireSession } from "@/features/auth/require-session";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import { Devices } from "./devices";
import { Profile } from "./profile";
import { Security } from "./security";

const t = en.account;
const auth = en.auth;
const user = {
  id: "u1",
  email: "an@example.com",
  display_name: "An",
  role: "user" as const,
  email_verified: false,
  created_at: "2026-11-01T10:00:00Z",
};
const captcha = { siteKey: null, nonce: null, devToken: "dev-token" };

let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  request = vi.spyOn(sessionApi, "request").mockImplementation(async (path) => {
    if (path === "/v1/me") return { user };
    throw new Error(`unexpected ${path}`);
  });
  requestVoid = vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
  assign = vi.fn();
  vi.stubGlobal("location", { assign, replace: vi.fn(), pathname: "/app/account", search: "" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const withSession = (ui: React.ReactNode) => render(<RequireSession messages={en.session}>{ui}</RequireSession>);
const click = (name: string | RegExp) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));

describe("Profile", () => {
  it("shows the account, flags an unverified address, and saves a new name", async () => {
    withSession(<Profile t={t} auth={auth} locale="en" captcha={captcha} />);
    expect(await screen.findByText("an@example.com")).toBeTruthy();
    expect(screen.getByText(t.unverified)).toBeTruthy();
    expect(screen.getByText("November 1, 2026")).toBeTruthy();

    const save = screen.getByRole("button", { name: t.save }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); // nothing changed yet

    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me" && opts?.method === "PATCH") return { user: { ...user, display_name: "An Nguyen" } };
      return { user };
    });
    fireEvent.change(screen.getByLabelText(t.nameLabel), { target: { value: "  An Nguyen " } });
    await click(t.save);
    expect(request).toHaveBeenCalledWith("/v1/me", { method: "PATCH", body: { display_name: "An Nguyen" } });
    expect(screen.getByText(t.saved)).toBeTruthy();
  });
});

describe("Profile verification", () => {
  it("sends a new link from the status line in one click", async () => {
    withSession(<Profile t={t} auth={auth} locale="en" captcha={captcha} />);
    await screen.findByText(t.unverified);
    request.mockImplementation(async (path) => (path === "/v1/me" ? { user } : {}));
    await click(t.sendNewLink);
    expect(request).toHaveBeenCalledWith("/v1/auth/resend-verification", {
      method: "POST",
      body: { email: "an@example.com", captcha_token: "dev-token" },
    });
    expect(screen.getByText("A new link is on its way to an@example.com.")).toBeTruthy();
  });
});

describe("Security", () => {
  it("changes the password and explains that other devices were logged out", async () => {
    render(<Security t={t} auth={auth} locale="en" />);
    fireEvent.change(screen.getByLabelText(/^Current password/), { target: { value: "old-password" } });
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: "a-brand-new-one" } });
    await click(t.passwordSubmit);
    expect(requestVoid).toHaveBeenCalledWith("/v1/me/password", {
      method: "POST",
      body: { current_password: "old-password", new_password: "a-brand-new-one" },
    });
    expect(screen.getByText(t.passwordChanged)).toBeTruthy();
  });

  it("shows a wrong current password at its field", async () => {
    requestVoid.mockRejectedValueOnce(new ApiError(422, "validation_error", "x", "current_password"));
    render(<Security t={t} auth={auth} locale="en" />);
    fireEvent.change(screen.getByLabelText(/^Current password/), { target: { value: "wrong-one" } });
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: "a-brand-new-one" } });
    await click(t.passwordSubmit);
    expect(screen.getByText(t.currentWrong)).toBeTruthy();
  });

  it("deletes the account only after an explicit confirmation", async () => {
    render(<Security t={t} auth={auth} locale="vi" />);
    expect(screen.queryByRole("button", { name: t.deleteSubmit })).toBeNull();
    await click(t.deleteStart);
    fireEvent.change(screen.getByLabelText(new RegExp(t.deleteConfirm)), { target: { value: "my-password" } });
    await click(t.deleteSubmit);
    expect(requestVoid).toHaveBeenCalledWith("/v1/me", { method: "DELETE", body: { password: "my-password" } });
    expect(assign).toHaveBeenCalledWith("/vi");
  });

  it("closes the delete confirmation with Escape and returns focus", async () => {
    render(<Security t={t} auth={auth} locale="en" />);
    await click(t.deleteStart);
    const field = screen.getByLabelText(new RegExp(t.deleteConfirm));
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByLabelText(new RegExp(t.deleteConfirm))).toBeNull();
    expect(document.activeElement?.textContent).toBe(t.deleteStart);
  });

  it("explains why the last admin cannot leave", async () => {
    requestVoid.mockRejectedValueOnce(new ApiError(409, "last_admin", "x"));
    render(<Security t={t} auth={auth} locale="en" />);
    await click(t.deleteStart);
    fireEvent.change(screen.getByLabelText(new RegExp(t.deleteConfirm)), { target: { value: "my-password" } });
    await click(t.deleteSubmit);
    expect(screen.getByText(t.lastAdmin).getAttribute("role")).toBe("alert");
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("Devices", () => {
  const sessions = [
    {
      id: "s1",
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      created_at: "2026-11-20T10:00:00Z",
      last_seen_at: new Date().toISOString(),
      expires_at: "2026-12-20T10:00:00Z",
      current: true,
    },
    {
      id: "s2",
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      created_at: "2026-11-01T10:00:00Z",
      last_seen_at: "2026-11-10T10:00:00Z",
      expires_at: "2026-12-01T10:00:00Z",
      current: false,
    },
  ];

  beforeEach(() => {
    request.mockImplementation(async (path) => {
      if (path === "/v1/me/sessions") return { sessions };
      throw new Error(`unexpected ${path}`);
    });
  });

  it("names devices and marks this one", async () => {
    render(<Devices t={t} auth={auth} locale="en" />);
    expect(await screen.findByText("Chrome on macOS")).toBeTruthy();
    expect(screen.getByText("Safari on iOS")).toBeTruthy();
    expect(screen.getByText(t.thisDevice)).toBeTruthy();
  });

  it("logs out another device and drops it from the list", async () => {
    render(<Devices t={t} auth={auth} locale="en" />);
    await screen.findByText("Safari on iOS");
    await click("Log out Safari on iOS");
    expect(requestVoid).toHaveBeenCalledWith("/v1/me/sessions/s2", { method: "DELETE" });
    expect(screen.queryByText("Safari on iOS")).toBeNull();
    expect(screen.getByText("Safari on iOS has been logged out.")).toBeTruthy();
    await act(async () => void (await new Promise((r) => requestAnimationFrame(r))));
    expect(document.activeElement).toBe(screen.getByRole("list", { name: t.devicesTitle }));
  });

  it("offers no log-out button on this device's row, and logs out all the others", async () => {
    render(<Devices t={t} auth={auth} locale="en" />);
    await screen.findByText("Chrome on macOS");
    expect(screen.queryByRole("button", { name: "Log out Chrome on macOS" })).toBeNull();
    await click(t.logoutOthers);
    expect(requestVoid).toHaveBeenCalledTimes(1);
    expect(requestVoid).toHaveBeenCalledWith("/v1/me/sessions/s2", { method: "DELETE" });
    expect(screen.getByText(t.othersLoggedOut)).toBeTruthy();
    expect(screen.queryByRole("button", { name: t.logoutOthers })).toBeNull(); // nobody else left
  });
});

describe("expired session", () => {
  it("sends the visitor to log in again instead of showing an error", async () => {
    vi.stubGlobal("location", { assign, replace: vi.fn(), pathname: "/vi/app/account/devices", search: "" });
    const replace = window.location.replace as ReturnType<typeof vi.fn>;
    request.mockRejectedValue(new ApiError(401, "unauthenticated", "x"));
    render(<Devices t={t} auth={auth} locale="vi" />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/vi/login?return_to=%2Fvi%2Fapp%2Faccount%2Fdevices"));
  });
});

