// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordField } from "@/components/ui/text-field";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import { Captcha } from "./captcha";
import { LogoutButton } from "./logout-button";
import { VerifyEmail } from "./verify-email";

const labels = { label: en.auth.captchaLabel, loadFailed: en.auth.captchaLoadFailed, retry: en.auth.retry };
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete window.turnstile;
});

describe("Captcha", () => {
  let options: Record<string, (token?: string) => void>;
  let turnstile: { render: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    turnstile = {
      render: vi.fn((_el, o) => {
        options = o;
        return "w1";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    window.turnstile = turnstile;
  });

  const config = { siteKey: "site-key", nonce: "n0nce-value", devToken: null };

  it("renders the widget in the page language and hands tokens over", async () => {
    const onToken = vi.fn();
    render(<Captcha config={config} locale="vi" labels={labels} onToken={onToken} resetSignal={0} />);
    await act(async () => {});
    expect(turnstile.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ sitekey: "site-key", language: "vi" }));
    act(() => options.callback("tok-1"));
    expect(onToken).toHaveBeenLastCalledWith("tok-1");
    act(() => options["expired-callback"]());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("group", { name: en.auth.captchaLabel })).toBeTruthy();
  });

  it("asks for a fresh token after each submission", async () => {
    const onToken = vi.fn();
    const { rerender } = render(<Captcha config={config} locale="en" labels={labels} onToken={onToken} resetSignal={0} />);
    await act(async () => {});
    rerender(<Captcha config={config} locale="en" labels={labels} onToken={onToken} resetSignal={1} />);
    expect(turnstile.reset).toHaveBeenCalledWith("w1");
    expect(onToken).toHaveBeenLastCalledWith(null);
  });

  it("shows a failure with a retry that renders the widget again", async () => {
    render(<Captcha config={config} locale="en" labels={labels} onToken={vi.fn()} resetSignal={0} />);
    await act(async () => {});
    act(() => options["error-callback"]());
    expect(screen.getByRole("alert").textContent).toContain(en.auth.captchaLoadFailed);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: en.auth.retry })));
    expect(turnstile.remove).toHaveBeenCalledWith("w1");
    expect(turnstile.render).toHaveBeenCalledTimes(2);
  });

  it("uses the server's development token when there is no site key", () => {
    const onToken = vi.fn();
    render(<Captcha config={{ siteKey: null, nonce: null, devToken: "dev-token" }} locale="en" labels={labels} onToken={onToken} resetSignal={0} />);
    expect(onToken).toHaveBeenCalledWith("dev-token");
    expect(turnstile.render).not.toHaveBeenCalled();
  });
});

describe("LogoutButton", () => {
  let assign: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/vi/app", search: "" });
  });

  it.each([
    ["ends the session", () => Promise.resolve()],
    ["treats an already ended session as logged out", () => Promise.reject(new ApiError(401, "unauthenticated", "x"))],
  ])("%s", async (_, outcome) => {
    vi.spyOn(sessionApi, "requestVoid").mockImplementation(outcome);
    render(<LogoutButton t={en.auth} locale="vi" />);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: en.auth.logout })));
    expect(assign).toHaveBeenCalledWith("/vi");
  });

  it("does not pretend to log out when the API failed", async () => {
    vi.spyOn(sessionApi, "requestVoid").mockRejectedValue(new ApiError(0, "network_error", "x"));
    render(<LogoutButton t={en.auth} locale="en" />);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: en.auth.logout })));
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(en.auth.errors.network);
  });
});

describe("PasswordField", () => {
  it("reveals the password with one stable label and aria-pressed", () => {
    render(<PasswordField label="Password" showLabel="Show password" value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(input.type).toBe("password");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Show password" })).toBe(toggle);
  });
});

describe("VerifyEmail retry", () => {
  it("retries after a network error and focuses the outcome", async () => {
    vi.stubGlobal("location", { pathname: "/verify-email", search: "", hash: `#token=${TOKEN}` });
    vi.stubGlobal("history", { state: null, replaceState: vi.fn() });
    const post = vi
      .spyOn(sessionApi, "requestVoid")
      .mockRejectedValueOnce(new ApiError(0, "network_error", "x"))
      .mockResolvedValue();
    render(<VerifyEmail t={en.auth} locale="en" captcha={{ siteKey: null, nonce: null, devToken: "dev-token" }} />);
    expect(await screen.findByText(en.auth.errors.network)).toBeTruthy();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: en.auth.retry })));
    expect(await screen.findByText(en.auth.verified)).toBeTruthy();
    expect(post).toHaveBeenCalledTimes(2);
    expect(document.activeElement?.getAttribute("role")).toBe("status");
  });
});
