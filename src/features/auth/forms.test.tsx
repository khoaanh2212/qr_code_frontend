// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import { ForgotForm } from "./forgot-form";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { ResetForm } from "./reset-form";
import { VerifyEmail } from "./verify-email";

const t = en.auth;
const noCaptcha = { siteKey: null, nonce: null, devToken: "dev-token" };
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

let request: MockInstance<typeof sessionApi.request>;
let assign: ReturnType<typeof vi.fn>;
let replaceState: ReturnType<typeof vi.fn>;

function stubLocation(path: string, search = "", hash = "") {
  assign = vi.fn();
  replaceState = vi.fn();
  vi.stubGlobal("location", { pathname: path, search, hash, assign, replace: vi.fn() });
  vi.stubGlobal("history", { state: null, replaceState });
}

beforeEach(() => {
  request = vi.spyOn(sessionApi, "request").mockResolvedValue({});
  stubLocation("/login");
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: string) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));

describe("LoginForm", () => {
  it("validates before calling the API and focuses the first problem", async () => {
    render(<LoginForm t={t} locale="en" />);
    await submit(t.loginSubmit);
    expect(request).not.toHaveBeenCalled();
    expect(screen.getAllByText(t.errors.required)).toHaveLength(2); // email and password
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
  });

  it("logs in and follows a safe return_to", async () => {
    stubLocation("/vi/login", "?return_to=%2Fvi%2Fapp%2Fcodes");
    render(<LoginForm t={t} locale="vi" />);
    type(/^Email/, " a@example.com ");
    type(/^Password/, "correct-horse");
    await submit(t.loginSubmit);
    expect(request).toHaveBeenCalledWith("/v1/auth/login", {
      method: "POST",
      body: { email: "a@example.com", password: "correct-horse" },
    });
    expect(assign).toHaveBeenCalledWith("/vi/app/codes");
  });

  it("goes to the second step when the account has two-step verification, keeping return_to", async () => {
    stubLocation("/vi/login", "?return_to=%2Fvi%2Fapp%2Fcodes");
    request.mockResolvedValueOnce({ mfa_required: true, methods: ["totp"] });
    render(<LoginForm t={t} locale="vi" />);
    type(/^Email/, "a@example.com");
    type(/^Password/, "correct-horse");
    await submit(t.loginSubmit);
    expect(assign).toHaveBeenCalledWith("/vi/login/verify?return_to=%2Fvi%2Fapp%2Fcodes");
  });

  it("ignores an unsafe return_to", async () => {
    stubLocation("/login", "?return_to=%2F%2Fevil.com");
    render(<LoginForm t={t} locale="en" />);
    type(/^Email/, "a@example.com");
    type(/^Password/, "x");
    await submit(t.loginSubmit);
    expect(assign).toHaveBeenCalledWith("/app");
  });

  it("shows one generic error for wrong credentials", async () => {
    request.mockRejectedValueOnce(new ApiError(401, "invalid_credentials", "no"));
    render(<LoginForm t={t} locale="en" />);
    type(/^Email/, "a@example.com");
    type(/^Password/, "wrong-password");
    await submit(t.loginSubmit);
    expect(screen.getByRole("alert").textContent).toBe(t.errors.invalidCredentials);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("RegisterForm", () => {
  it("checks the password length like the API, then shows the check-email screen", async () => {
    render(<RegisterForm t={t} locale="en" captcha={noCaptcha} />);
    type(/^Email/, "new@example.com");
    type(/^Password/, "short");
    await submit(t.registerSubmit);
    expect(screen.getByText(t.errors.passwordShort)).toBeTruthy();
    expect(request).not.toHaveBeenCalled();

    type(/^Password/, "long-enough-password");
    await submit(t.registerSubmit);
    expect(request).toHaveBeenCalledWith("/v1/auth/register", {
      method: "POST",
      body: { email: "new@example.com", password: "long-enough-password", captcha_token: "dev-token" },
    });
    expect(screen.getByText(t.checkEmailTitle)).toBeTruthy();
    expect(screen.getByText(/new@example\.com/)).toBeTruthy();
  });
});

describe("ForgotForm", () => {
  it("always answers with the same neutral confirmation", async () => {
    render(<ForgotForm t={t} locale="en" captcha={noCaptcha} />);
    type(/^Email/, "someone@example.com");
    await submit(t.forgotSubmit);
    expect(screen.getByText(/If someone@example\.com has an account/)).toBeTruthy();
  });
});

describe("ResetForm", () => {
  it("reads the token from the fragment, removes it from the address, and resets", async () => {
    stubLocation("/reset-password", "", `#token=${TOKEN}`);
    render(<ResetForm t={t} locale="en" />);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/reset-password");
    type(/^New password/, "brand-new-password");
    await submit(t.resetSubmit);
    expect(request).toHaveBeenCalledWith("/v1/auth/reset-password", {
      method: "POST",
      body: { token: TOKEN, password: "brand-new-password" },
    });
    expect(screen.getByText(t.resetDone)).toBeTruthy();
  });

  it("explains an expired link", async () => {
    stubLocation("/reset-password", "", `#token=${TOKEN}`);
    request.mockRejectedValueOnce(new ApiError(400, "invalid_token", "x"));
    render(<ResetForm t={t} locale="en" />);
    type(/^New password/, "brand-new-password");
    await submit(t.resetSubmit);
    expect(screen.getByText(t.resetInvalid)).toBeTruthy();
  });

  it("explains a link without a token", () => {
    stubLocation("/reset-password");
    render(<ResetForm t={t} locale="en" />);
    expect(screen.getByText(t.tokenMissing)).toBeTruthy();
  });
});

describe("VerifyEmail", () => {
  it("posts the single-use token exactly once, even in strict mode", async () => {
    stubLocation("/verify-email", "", `#token=${TOKEN}`);
    const posted = vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
    render(
      <StrictMode>
        <VerifyEmail t={t} locale="en" captcha={noCaptcha} />
      </StrictMode>,
    );
    expect(await screen.findByText(t.verified)).toBeTruthy();
    expect(posted).toHaveBeenCalledTimes(1);
    expect(posted).toHaveBeenCalledWith("/v1/auth/verify-email", { method: "POST", body: { token: TOKEN } });
  });

  it("offers a new link when the token expired", async () => {
    stubLocation("/verify-email", "", `#token=${TOKEN}`);
    vi.spyOn(sessionApi, "requestVoid").mockRejectedValue(new ApiError(400, "invalid_token", "x"));
    render(<VerifyEmail t={t} locale="en" captcha={noCaptcha} />);
    expect(await screen.findByText(t.verifyInvalid)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.resendSubmit })).toBeTruthy();
  });
});

describe("critique fixes", () => {
  it("clears a field's error as soon as it is edited", async () => {
    render(<LoginForm t={t} locale="en" />);
    await submit(t.loginSubmit);
    expect(screen.getAllByText(t.errors.required)).toHaveLength(2);
    type(/^Email/, "a@example.com");
    expect(screen.getAllByText(t.errors.required)).toHaveLength(1);
  });

  it("offers the email typed on the login page on the forgot-password page", () => {
    const { unmount } = render(<LoginForm t={t} locale="en" />);
    type(/^Email/, "kept@example.com");
    unmount();
    render(<ForgotForm t={t} locale="en" captcha={noCaptcha} />);
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("kept@example.com");
  });

  it("check-email: one heading, resend only on demand, and a way back to fix the address", async () => {
    render(<RegisterForm t={t} locale="en" captcha={noCaptcha} />);
    type(/^Email/, "typo@exmaple.com");
    type(/^Password/, "long-enough-password");
    await submit(t.registerSubmit);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t.checkEmailTitle);
    expect(screen.getAllByText(t.toLogin)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: t.resendSubmit })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.didntGetIt }));
    expect(screen.getByRole("button", { name: t.resendSubmit })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: t.useDifferentEmail }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t.registerTitle);
    expect((screen.getByLabelText(/^Email/) as HTMLInputElement).value).toBe("typo@exmaple.com");
  });

  it("marks outcomes with an icon, not only color, and takes focus", async () => {
    stubLocation("/reset-password", "", `#token=${TOKEN}`);
    render(<ResetForm t={t} locale="en" />);
    type(/^New password/, "brand-new-password");
    await submit(t.resetSubmit);
    const notice = screen.getByRole("status");
    expect(notice.querySelector("svg")).toBeTruthy();
    expect(document.activeElement).toBe(notice);
    expect(screen.getByRole("link", { name: t.loginSubmit })).toBeTruthy();
  });
});

