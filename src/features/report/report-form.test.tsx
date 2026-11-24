// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, publicApi } from "@/lib/api";
import { ReportForm } from "./report-form";

const t = en.report;
const noCaptcha = { siteKey: null, nonce: null, devToken: "dev-token" };

let request: MockInstance<typeof publicApi.request>;

beforeEach(() => {
  request = vi.spyOn(publicApi, "request").mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => act(async () => void fireEvent.click(screen.getByRole("button", { name: t.submit })));

describe("ReportForm", () => {
  it("validates the link and the reason before calling the API", async () => {
    render(<ReportForm t={t} locale="en" captcha={noCaptcha} />);
    await submit();
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(t.errors.linkRequired)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Short link/));

    type(/^Short link/, "https://example.com/menu");
    await submit();
    expect(screen.getByText(t.errors.linkInvalid)).toBeTruthy();

    type(/^Short link/, "AbCd1234");
    await submit();
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(t.errors.reasonRequired)).toBeTruthy();
  });

  it("sends the code found in a pasted short link and thanks the visitor", async () => {
    render(<ReportForm t={t} locale="en" captcha={noCaptcha} />);
    type(/^Short link/, " https://s.proofqr.app/AbCd1234?x=1 ");
    fireEvent.click(screen.getByLabelText(t.reasons.phishing));
    type(/^Details/, "  Fake bank login  ");
    await submit();
    expect(request).toHaveBeenCalledWith("/v1/reports", {
      method: "POST",
      body: { short_code: "AbCd1234", reason: "phishing", details: "Fake bank login", captcha_token: "dev-token" },
    });
    expect(screen.getByRole("status").textContent).toContain(t.sentTitle);
    expect(document.activeElement).toBe(screen.getByRole("status"));
  });

  it("waits for the security check", async () => {
    render(<ReportForm t={t} locale="en" captcha={{ siteKey: "site-key", nonce: null, devToken: null }} initialCode="AbCd1234" />);
    fireEvent.click(screen.getByLabelText(t.reasons.other));
    await submit();
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(t.errors.captchaRequired);
  });

  it.each([
    [new ApiError(422, "validation_error", "no", "reason"), t.errors.reasonRequired, t.reasons.phishing],
    [new ApiError(403, "captcha_failed", "no"), t.errors.captchaFailed, null],
    [new ApiError(0, "network_error", ""), t.errors.network, null],
  ])("explains %s", async (err, message, focused) => {
    request.mockRejectedValueOnce(err);
    render(<ReportForm t={t} locale="en" captcha={noCaptcha} initialCode="AbCd1234" />);
    fireEvent.click(screen.getByLabelText(t.reasons.malware));
    await submit();
    expect(screen.getByText(message)).toBeTruthy();
    if (focused) expect(document.activeElement).toBe(screen.getByLabelText(focused));
  });

  it("prefills the code and shows an unknown link at the field", async () => {
    request.mockRejectedValueOnce(new ApiError(404, "not_found", "no"));
    render(<ReportForm t={t} locale="en" captcha={noCaptcha} initialCode="AbCd1234" />);
    expect((screen.getByLabelText(/^Short link/) as HTMLInputElement).value).toBe("AbCd1234");
    fireEvent.click(screen.getByLabelText(t.reasons.scam));
    await submit();
    expect(screen.getByText(t.errors.notFound)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Short link/));
  });

  it("refuses details over the limit and explains rate limits", async () => {
    render(<ReportForm t={t} locale="en" captcha={noCaptcha} initialCode="AbCd1234" />);
    fireEvent.click(screen.getByLabelText(t.reasons.spam));
    type(/^Details/, "x".repeat(501));
    await submit();
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText("Details can be at most 500 characters.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Details/));

    type(/^Details/, "ok");
    request.mockRejectedValueOnce(new ApiError(429, "rate_limited", "slow down", undefined, 30));
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("Too many reports from your network. Try again in 30 seconds.");
  });
});
