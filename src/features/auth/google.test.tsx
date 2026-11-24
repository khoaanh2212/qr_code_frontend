// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import { GoogleSignIn, googleStartUrl } from "./google";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("googleStartUrl", () => {
  it("points at the API with a return path, and asks for a re-authentication when told", () => {
    const login = new URL(googleStartUrl({ returnTo: "/vi/app" }));
    expect(login.origin).toBe("http://localhost:8080");
    expect(login.pathname).toBe("/v1/auth/google/start");
    expect(login.searchParams.get("return_to")).toBe("/vi/app");
    expect(login.searchParams.has("intent")).toBe(false);
    const reauth = new URL(googleStartUrl({ returnTo: "/app/account/security", reauth: true }));
    expect(reauth.searchParams.get("intent")).toBe("reauth");
  });
});

describe("GoogleSignIn", () => {
  it("links to Google with the page's safe return_to", () => {
    vi.stubGlobal("location", { pathname: "/vi/login", search: "?return_to=%2Fvi%2Fapp%2Faccount" });
    render(<GoogleSignIn t={en.auth} locale="vi" enabled />);
    const link = screen.getByRole("link", { name: en.auth.googleContinue });
    expect(new URL(link.getAttribute("href")!).searchParams.get("return_to")).toBe("/vi/app/account");
  });

  it("never carries an unsafe return_to to the API", () => {
    vi.stubGlobal("location", { pathname: "/login", search: "?return_to=%2F%2Fevil.example" });
    render(<GoogleSignIn t={en.auth} locale="en" enabled />);
    const link = screen.getByRole("link", { name: en.auth.googleContinue });
    expect(new URL(link.getAttribute("href")!).searchParams.get("return_to")).toBe("/app");
  });

  it("explains a failed Google login", () => {
    vi.stubGlobal("location", { pathname: "/login", search: "?error=google_login_failed" });
    render(<GoogleSignIn t={en.auth} locale="en" enabled />);
    expect(screen.getByRole("alert").textContent).toBe(en.auth.googleFailed);
  });

  it("renders nothing when Google login is off", () => {
    vi.stubGlobal("location", { pathname: "/login", search: "" });
    const { container } = render(<GoogleSignIn t={en.auth} locale="en" enabled={false} />);
    expect(container.textContent).toBe("");
  });
});
