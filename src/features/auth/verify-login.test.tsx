// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import { VerifyLogin } from "./verify-login";

const webauthn = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => true),
}));
vi.mock("@simplewebauthn/browser", () => webauthn);

const t = en.auth;
const v = en.auth.verify;

let request: MockInstance<typeof sessionApi.request>;
let assign: ReturnType<typeof vi.fn>;

function stubLocation(path: string, search = "") {
  assign = vi.fn();
  vi.stubGlobal("location", { pathname: path, search, hash: "", assign, replace: vi.fn() });
}

/** Answers the pending-login status with `methods`, then `rest` in order. */
function api(methods: string[] | ApiError, ...rest: Array<unknown | ApiError>) {
  request.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/v1/auth/login/mfa" && (init?.method ?? "GET") === "GET") {
      if (methods instanceof ApiError) throw methods;
      return { methods, expires_at: "2026-11-25T10:05:00Z" };
    }
    const next = rest.shift();
    if (next instanceof ApiError) throw next;
    return next ?? {};
  });
}

beforeEach(() => {
  request = vi.spyOn(sessionApi, "request");
  stubLocation("/vi/login/verify", "?return_to=%2Fvi%2Fapp%2Fcodes");
  webauthn.startAuthentication.mockReset();
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const show = async (methods: string[] | ApiError, ...rest: Array<unknown | ApiError>) => {
  api(methods, ...rest);
  render(<VerifyLogin t={t} locale="vi" />);
  await waitFor(() => expect(request).toHaveBeenCalledWith("/v1/auth/login/mfa", { method: "GET" }));
};
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));

describe("VerifyLogin", () => {
  it("reads the methods from the pending login and starts with the authenticator app", async () => {
    await show(["totp", "passkey", "recovery_code"]);
    expect(await screen.findByLabelText(v.codeLabel)).toBeTruthy();
    // The other methods are offered as alternatives.
    expect(screen.getByRole("button", { name: v.usePasskeyInstead })).toBeTruthy();
    expect(screen.getByRole("button", { name: v.useRecoveryInstead })).toBeTruthy();
    expect(screen.queryByRole("button", { name: v.useAppInstead })).toBeNull();
  });

  it("finishes with an app code and follows a safe return_to", async () => {
    await show(["totp", "recovery_code"], { user: {} });
    type(v.codeLabel, " 123 456 ");
    await click(v.submit);
    expect(request).toHaveBeenCalledWith("/v1/auth/login/mfa", { method: "POST", body: { method: "totp", code: "123456" } });
    expect(assign).toHaveBeenCalledWith("/vi/app/codes");
  });

  it("accepts a pasted code with a dash or spaces", async () => {
    await show(["totp"], { user: {} });
    type(v.codeLabel, "123-456");
    await click(v.submit);
    expect(request).toHaveBeenCalledWith("/v1/auth/login/mfa", { method: "POST", body: { method: "totp", code: "123456" } });
  });

  it("asks for a recovery code before sending an empty one", async () => {
    await show(["recovery_code"]);
    await click(v.submit);
    expect(screen.getByText(t.errors.required)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(v.recoveryLabel));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("checks the app code before sending it", async () => {
    await show(["totp"]);
    type(v.codeLabel, "12345");
    await click(v.submit);
    expect(screen.getByText(v.codeInvalid)).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1); // only the status
    expect(document.activeElement).toBe(screen.getByLabelText(v.codeLabel));
  });

  it("explains a refused code and keeps the form", async () => {
    await show(["totp"], new ApiError(422, "invalid_mfa_code", "no"));
    type(v.codeLabel, "000000");
    await click(v.submit);
    expect(screen.getByRole("alert").textContent).toBe(v.codeRefused);
    expect(assign).not.toHaveBeenCalled();
  });

  it("switches to a recovery code and sends it", async () => {
    await show(["totp", "recovery_code"], { user: {} });
    await click(v.useRecoveryInstead);
    expect(document.activeElement).toBe(screen.getByLabelText(v.recoveryLabel));
    type(v.recoveryLabel, "abcd-efgh-ijkl-mnop");
    await click(v.submit);
    expect(request).toHaveBeenCalledWith("/v1/auth/login/mfa", {
      method: "POST",
      body: { method: "recovery_code", code: "abcd-efgh-ijkl-mnop" },
    });
    expect(assign).toHaveBeenCalledWith("/vi/app/codes");
  });

  it("explains a refused recovery code", async () => {
    await show(["recovery_code"], new ApiError(422, "invalid_mfa_code", "no"));
    type(v.recoveryLabel, "abcd-efgh-ijkl-mnop");
    await click(v.submit);
    expect(screen.getByRole("alert").textContent).toBe(v.recoveryRefused);
  });

  it("signs in with a passkey", async () => {
    const options = { publicKey: { challenge: "c", allowCredentials: [] } };
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-1" });
    await show(["passkey"], { passkey: options }, { user: {} });
    await click(v.passkeySubmit);
    expect(request).toHaveBeenCalledWith("/v1/auth/login/mfa/options", { method: "POST" });
    expect(webauthn.startAuthentication).toHaveBeenCalledWith({ optionsJSON: options.publicKey });
    expect(request).toHaveBeenCalledWith("/v1/auth/login/mfa", {
      method: "POST",
      body: { method: "passkey", assertion: { id: "cred-1" } },
    });
    expect(assign).toHaveBeenCalledWith("/vi/app/codes");
  });

  it("keeps the passkey button after the browser dialog was cancelled", async () => {
    webauthn.startAuthentication.mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    await show(["passkey"], { passkey: { publicKey: { challenge: "c" } } });
    await click(v.passkeySubmit);
    expect(screen.getByRole("alert").textContent).toBe(v.passkeyCancelled);
    // Focus stays on the button, not on the page.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: v.passkeySubmit }));
    expect(request).not.toHaveBeenCalledWith("/v1/auth/login/mfa", expect.objectContaining({ method: "POST" }));
  });

  it("explains a passkey the browser could not use", async () => {
    webauthn.startAuthentication.mockRejectedValue(Object.assign(new Error("no"), { name: "SecurityError" }));
    await show(["passkey"], { passkey: { publicKey: { challenge: "c" } } });
    await click(v.passkeySubmit);
    expect(screen.getByRole("alert").textContent).toBe(v.passkeyFailed);
  });

  it("explains a passkey the server refused", async () => {
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-1" });
    await show(["passkey"], { passkey: { publicKey: { challenge: "c" } } }, new ApiError(422, "invalid_mfa_code", "no"));
    await click(v.passkeySubmit);
    expect(screen.getByRole("alert").textContent).toBe(v.passkeyRefused);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: v.passkeySubmit }));
  });

  it("starts on the passkey button when that is the only way", async () => {
    await show(["passkey"]);
    expect(document.activeElement).toBe(await screen.findByRole("button", { name: v.passkeySubmit }));
  });

  it("says when this browser cannot use passkeys and offers the other methods", async () => {
    webauthn.browserSupportsWebAuthn.mockReturnValue(false);
    await show(["passkey", "recovery_code"]);
    expect(await screen.findByText(v.passkeyUnsupported)).toBeTruthy();
    expect(screen.getByRole("button", { name: v.useRecoveryInstead })).toBeTruthy();
  });

  it("sends an expired login back to log in, keeping return_to", async () => {
    await show(new ApiError(401, "mfa_login_expired", "gone"));
    expect(await screen.findByText(v.expired)).toBeTruthy();
    // The notice takes focus: the form that had it is gone.
    expect(document.activeElement).toBe(screen.getByRole("status"));
    expect(screen.getByRole("link", { name: v.startAgain }).getAttribute("href")).toBe(
      "/vi/login?return_to=%2Fvi%2Fapp%2Fcodes",
    );
    expect(screen.queryByLabelText(v.codeLabel)).toBeNull();
  });

  it("drops an unsafe return_to from the log-in link", async () => {
    stubLocation("/vi/login/verify", "?return_to=%2F%2Fevil.example");
    await show(new ApiError(401, "mfa_login_expired", "gone"));
    expect((await screen.findByRole("link", { name: v.startAgain })).getAttribute("href")).toBe("/vi/login");
  });

  it("ignores methods it does not know", async () => {
    await show(["totp", "magic_link"]);
    expect(await screen.findByLabelText(v.codeLabel)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: v.otherWays })).toBeNull();
  });

  it("checks the login again when the answer to a right code was lost", async () => {
    // The POST went through but the answer never arrived; the pending login is used up.
    request.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path === "/v1/auth/login/mfa" && (init?.method ?? "GET") === "GET") {
        if (request.mock.calls.length > 1) throw new ApiError(401, "mfa_login_expired", "gone");
        return { methods: ["totp"], expires_at: "2026-11-25T10:05:00Z" };
      }
      throw new ApiError(0, "network_error", "offline");
    });
    render(<VerifyLogin t={t} locale="vi" />);
    type(await screen.findByLabelText(v.codeLabel).then(() => v.codeLabel), "123456");
    await click(v.submit);
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/vi/app/codes"));
  });

  it("turns a login that expired during the step into the expired screen", async () => {
    await show(["totp"], new ApiError(401, "mfa_login_expired", "gone"));
    type(v.codeLabel, "123456");
    await click(v.submit);
    expect(screen.getByText(v.expired)).toBeTruthy();
    expect(screen.queryByLabelText(v.codeLabel)).toBeNull();
  });

  it("words the hourly limit on failures in plain terms", async () => {
    await show(["totp"], new ApiError(429, "rate_limited", "slow down", undefined, 3600));
    type(v.codeLabel, "123456");
    await click(v.submit);
    expect(screen.getByRole("alert").textContent).toBe(v.tooManyTries);
  });

  it("shows a short per-IP limit in seconds", async () => {
    await show(["totp"], new ApiError(429, "rate_limited", "slow down", undefined, 20));
    type(v.codeLabel, "123456");
    await click(v.submit);
    expect(screen.getByRole("alert").textContent).toBe(t.errors.rateLimited.replace("{seconds}", "20"));
  });

  it("offers a retry when the status cannot be loaded", async () => {
    await show(new ApiError(0, "network_error", "offline"));
    expect(await screen.findByText(t.errors.network)).toBeTruthy();
    api(["totp"]);
    await click(t.retry);
    expect(await screen.findByLabelText(v.codeLabel)).toBeTruthy();
  });
});
