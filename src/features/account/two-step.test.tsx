// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError, sessionApi } from "@/lib/api";
import type { MfaStatus } from "@/lib/api/types";
import { TwoStep } from "./two-step";

const webauthn = vi.hoisted(() => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
  browserSupportsWebAuthn: vi.fn(() => true),
}));
vi.mock("@simplewebauthn/browser", () => webauthn);

const t = en.account;
const s = en.account.twoStep;
const auth = en.auth;

const off: MfaStatus = { enabled: false, totp: false, passkeys: [], recovery_codes_left: 0 };
const key = { id: "8f0c0c4e-0000-4000-8000-000000000001", name: "MacBook", created_at: "2026-11-20T10:00:00Z", last_used_at: null };
const on: MfaStatus = { enabled: true, totp: true, passkeys: [key], recovery_codes_left: 7 };
const CODES = Array.from({ length: 10 }, (_, i) => `aaaa-bbbb-cccc-${String(i).padStart(4, "0")}`);
const SETUP = { totp: { secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/ProofQR:a@example.com?secret=JBSWY3DPEHPK3PXP", expires_at: "2026-11-25T10:10:00Z" } };

type Handler = (body: unknown) => unknown;
let routes: Record<string, Handler | Handler[]>;
let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let requestBlob: MockInstance<typeof sessionApi.requestBlob>;

/** Answers `METHOD path` from `routes`; a list answers in order, then repeats its last entry. */
function answer(path: string, init?: { method?: string; body?: unknown }) {
  const k = `${init?.method ?? "GET"} ${path}`;
  const r = routes[k];
  if (!r) throw new Error(`unexpected ${k}`);
  const h = Array.isArray(r) ? (r.length > 1 ? r.shift()! : r[0]!) : r;
  return h(init?.body);
}
const reply = (v: unknown) => () => v;
const fail = (status: number, code: string, field?: string) => () => {
  throw new ApiError(status, code, code, field);
};
const needsStepUp = fail(403, "reauth_required");

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  routes = {};
  request = vi.spyOn(sessionApi, "request").mockImplementation(async (p, i) => answer(p, i));
  requestVoid = vi.spyOn(sessionApi, "requestVoid").mockImplementation(async (p, i) => void answer(p, i));
  requestBlob = vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["<svg/>"], { type: "image/svg+xml" }));
  URL.createObjectURL = vi.fn(() => "blob:qr");
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal("location", { pathname: "/vi/app/account/security", search: "", hash: "", href: "http://localhost/vi/app/account/security", assign: vi.fn(), replace: vi.fn() });
  webauthn.startRegistration.mockReset();
  webauthn.browserSupportsWebAuthn.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const show = async (status: MfaStatus, hasPassword = true) => {
  routes["GET /v1/me/mfa"] = reply({ mfa: status });
  render(<TwoStep t={t} auth={auth} locale="vi" hasPassword={hasPassword} />);
  await screen.findByRole("heading", { name: s.title });
  await waitFor(() => expect(screen.queryByText(auth.working)).toBeNull());
};
const click = (name: string | RegExp, scope: HTMLElement = document.body) =>
  act(async () => void fireEvent.click(within(scope).getByRole("button", { name })));
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const dialog = () => screen.getByRole("dialog");

/** Answers the step-up panel with the password. */
async function confirmPassword(password = "correct horse") {
  expect(await screen.findByLabelText(s.stepUpPassword)).toBeTruthy();
  type(s.stepUpPassword, password);
  await click(s.stepUpSubmit);
}

describe("TwoStep", () => {
  it("shows that it is off and how to turn it on", async () => {
    await show(off);
    expect(screen.getByText(s.statusOff)).toBeTruthy();
    expect(screen.getByRole("button", { name: s.setUpApp })).toBeTruthy();
    expect(screen.getByRole("button", { name: s.addPasskey })).toBeTruthy();
    expect(screen.queryByRole("button", { name: s.turnOff })).toBeNull();
  });

  it("sets up an authenticator app after the password, then shows the recovery codes once", async () => {
    routes["POST /v1/me/mfa/totp"] = [needsStepUp, reply(SETUP)];
    routes["POST /v1/me/reauth"] = reply(undefined);
    routes["POST /v1/me/mfa/totp/confirm"] = reply({ mfa: { ...off, enabled: true, totp: true, recovery_codes_left: 10 }, recovery_codes: CODES });
    await show(off);

    await click(s.setUpApp);
    await confirmPassword();
    expect(requestVoid).toHaveBeenCalledWith("/v1/me/reauth", { method: "POST", body: { password: "correct horse" } });

    // The secret is shown as text and as a QR code rendered by our own API (POST, never a URL).
    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
    expect(requestBlob).toHaveBeenCalledWith("/v1/qr/render", {
      method: "POST",
      body: { type: "text", data: { text: SETUP.totp.uri }, format: "svg", size: 240, margin: 2, ecc: "M" },
    });
    expect(screen.getByRole("img", { name: s.qrAlt })).toBeTruthy();

    type(s.confirmCodeLabel, "123 456");
    await click(s.confirmApp);
    expect(request).toHaveBeenCalledWith("/v1/me/mfa/totp/confirm", { method: "POST", body: { code: "123456" } });

    const list = await screen.findByRole("list", { name: s.codesTitle });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByRole("button", { name: s.codesDownload })).toBeTruthy();
    await click(s.codesDone);
    expect(screen.queryByRole("list", { name: s.codesTitle })).toBeNull();
    expect(screen.getByText(s.statusOn)).toBeTruthy();
  });

  it("explains a wrong confirmation code and keeps the setup", async () => {
    routes["POST /v1/me/mfa/totp"] = reply(SETUP);
    routes["POST /v1/me/mfa/totp/confirm"] = fail(422, "invalid_mfa_code");
    await show(off);
    await click(s.setUpApp);
    await screen.findByLabelText(s.confirmCodeLabel);
    type(s.confirmCodeLabel, "000000");
    await click(s.confirmApp);
    expect(screen.getByText(s.confirmCodeRefused)).toBeTruthy();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
  });

  it("explains a wrong password in the step-up and lets the person cancel", async () => {
    routes["POST /v1/me/mfa/totp"] = needsStepUp;
    routes["POST /v1/me/reauth"] = fail(422, "validation_error", "password");
    await show(off);
    await click(s.setUpApp);
    await confirmPassword("wrong");
    expect(screen.getByText(s.stepUpWrong)).toBeTruthy();
    await click(t.cancel);
    expect(screen.queryByLabelText(s.stepUpPassword)).toBeNull();
    expect(screen.getByRole("button", { name: s.setUpApp })).toBeTruthy();
  });

  it("confirms with Google when the account has no password", async () => {
    routes["POST /v1/me/mfa/totp"] = needsStepUp;
    await show(off, false);
    await click(s.setUpApp);
    const link = await screen.findByRole("link", { name: s.stepUpGoogle });
    const href = new URL(link.getAttribute("href")!, "http://localhost");
    expect(href.searchParams.get("intent")).toBe("reauth");
    expect(href.searchParams.get("return_to")).toBe("/vi/app/account/security?two_step=confirm");
  });

  it("says when the person is back from the Google confirmation, once", async () => {
    const replaceState = vi.fn();
    vi.stubGlobal("location", { pathname: "/vi/app/account/security", search: "?two_step=confirm", hash: "", assign: vi.fn() });
    vi.stubGlobal("history", { state: null, replaceState });
    await show(off, false);
    expect(screen.getByText(s.googleConfirmed)).toBeTruthy();
    expect(replaceState).toHaveBeenCalledWith(null, "", "/vi/app/account/security");
  });

  it("lists the factors when it is on", async () => {
    await show(on);
    expect(screen.getByText(s.statusOn)).toBeTruthy();
    expect(screen.getByText(s.appOn)).toBeTruthy();
    expect(screen.getByText("MacBook")).toBeTruthy();
    expect(screen.getByText(s.codesLeft.replace("{count}", "7"))).toBeTruthy();
    expect(screen.getByRole("button", { name: s.removeApp })).toBeTruthy();
    expect(screen.getByRole("button", { name: s.removePasskeyNamed.replace("{name}", "MacBook") })).toBeTruthy();
  });

  it("adds a passkey with a name", async () => {
    const options = { token: "tok", passkey: { publicKey: { challenge: "c", rp: { name: "ProofQR" } } } };
    webauthn.startRegistration.mockResolvedValue({ id: "cred-2" });
    routes["POST /v1/me/mfa/passkeys/options"] = reply(options);
    routes["POST /v1/me/mfa/passkeys"] = reply({ mfa: { ...on, passkeys: [key, { ...key, id: "k2", name: "Phone" }] } });
    await show(on);
    await click(s.addPasskey);
    type(s.passkeyName, "Phone");
    await click(s.passkeyCreate);
    expect(webauthn.startRegistration).toHaveBeenCalledWith({ optionsJSON: options.passkey.publicKey });
    expect(request).toHaveBeenCalledWith("/v1/me/mfa/passkeys", {
      method: "POST",
      body: { token: "tok", attestation: { id: "cred-2" }, name: "Phone" },
    });
    expect(await screen.findByText("Phone")).toBeTruthy();
  });

  it("removes the app after a confirmation", async () => {
    routes["DELETE /v1/me/mfa/totp"] = reply({ mfa: { ...on, totp: false } });
    await show(on);
    await click(s.removeApp);
    expect(dialog().textContent).toContain(s.removeAppBody);
    await click(s.removeConfirm, dialog());
    expect(request).toHaveBeenCalledWith("/v1/me/mfa/totp", { method: "DELETE" });
    await waitFor(() => expect(screen.queryByText(s.appOn)).toBeNull());
  });

  it("makes new recovery codes after a confirmation", async () => {
    routes["POST /v1/me/mfa/recovery-codes"] = reply({ recovery_codes: CODES });
    await show(on);
    await click(s.codesRegenerate);
    await click(s.codesRegenerateConfirm, dialog());
    const list = await screen.findByRole("list", { name: s.codesTitle });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  });

  it("turns it off by removing every factor", async () => {
    routes["DELETE /v1/me/mfa/totp"] = reply({ mfa: { ...on, totp: false } });
    routes[`DELETE /v1/me/mfa/passkeys/${key.id}`] = reply({ mfa: off });
    await show(on);
    await click(s.turnOff);
    await click(s.turnOffConfirm, dialog());
    expect(request).toHaveBeenCalledWith("/v1/me/mfa/totp", { method: "DELETE" });
    expect(request).toHaveBeenCalledWith(`/v1/me/mfa/passkeys/${key.id}`, { method: "DELETE" });
    expect(await screen.findByText(s.statusOff)).toBeTruthy();
  });

  it("finishes turning off after a removal failed halfway", async () => {
    const second = { ...key, id: "8f0c0c4e-0000-4000-8000-000000000002", name: "Phone" };
    const both = { ...on, passkeys: [key, second] };
    routes["GET /v1/me/mfa"] = [reply({ mfa: both }), reply({ mfa: { ...both, totp: false, passkeys: [second] } })];
    routes["DELETE /v1/me/mfa/totp"] = reply({ mfa: { ...both, totp: false } });
    routes[`DELETE /v1/me/mfa/passkeys/${key.id}`] = fail(404, "not_found"); // removed in another tab
    routes[`DELETE /v1/me/mfa/passkeys/${second.id}`] = [fail(0, "network_error"), reply({ mfa: off })];
    render(<TwoStep t={t} auth={auth} locale="vi" hasPassword />);
    await screen.findByText(s.statusOn);

    await click(s.turnOff);
    await click(s.turnOffConfirm, dialog());
    // The failure is shown and the list matches the server again.
    expect(await screen.findByText(auth.errors.network)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(s.appOn)).toBeNull());

    // Trying again removes only what is left.
    await click(s.turnOffConfirm, dialog());
    expect(await screen.findByText(s.statusOff)).toBeTruthy();
    expect(request.mock.calls.filter(([p, i]) => p === "/v1/me/mfa/totp" && i?.method === "DELETE")).toHaveLength(1);
  });

  it("treats a passkey already removed elsewhere as removed", async () => {
    routes["GET /v1/me/mfa"] = [reply({ mfa: on }), reply({ mfa: { ...on, passkeys: [] } })];
    routes[`DELETE /v1/me/mfa/passkeys/${key.id}`] = fail(404, "not_found");
    render(<TwoStep t={t} auth={auth} locale="vi" hasPassword />);
    await click(await screen.findByRole("button", { name: s.removePasskeyNamed.replace("{name}", "MacBook") }).then((b) => b.getAttribute("aria-label")!));
    await click(s.removeConfirm, dialog());
    await waitFor(() => expect(screen.queryByText("MacBook")).toBeNull());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks for the step-up from a dialog and then makes the change", async () => {
    routes["DELETE /v1/me/mfa/totp"] = [needsStepUp, reply({ mfa: { ...on, totp: false } })];
    routes["POST /v1/me/reauth"] = reply(undefined);
    await show(on);
    await click(s.removeApp);
    await click(s.removeConfirm, dialog());
    expect(screen.queryByRole("dialog")).toBeNull();
    await confirmPassword();
    await waitFor(() => expect(screen.queryByText(s.appOn)).toBeNull());
  });

  it("puts focus on the status after a change or a cancel, not on the page", async () => {
    routes["DELETE /v1/me/mfa/totp"] = reply({ mfa: { ...on, totp: false } });
    routes["POST /v1/me/mfa/totp"] = reply(SETUP);
    await show(on);
    await click(s.removeApp);
    await click(s.removeConfirm, dialog());
    await waitFor(() => expect(document.activeElement?.textContent).toBe(s.statusOn));

    await click(s.setUpApp);
    await waitFor(() => expect(document.activeElement?.textContent).toBe(s.setUpApp)); // the panel's heading
    await click(t.cancel);
    await waitFor(() => expect(document.activeElement?.textContent).toBe(s.statusOn));
  });

  it("cancel in a dialog sends nothing", async () => {
    await show(on);
    await click(s.turnOff);
    await click(t.cancel, dialog());
    expect(request).toHaveBeenCalledTimes(1); // the status only
  });

  it("explains a cancelled passkey dialog and a passkey request that expired", async () => {
    routes["POST /v1/me/mfa/passkeys/options"] = reply({ token: "tok", passkey: { publicKey: { challenge: "c" } } });
    routes["POST /v1/me/mfa/passkeys"] = fail(400, "invalid_token");
    webauthn.startRegistration.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotAllowedError" })).mockResolvedValue({ id: "c" });
    await show(on);
    await click(s.addPasskey);
    type(s.passkeyName, "Phone");
    await click(s.passkeyCreate);
    expect(screen.getByText(s.passkeyCancelled)).toBeTruthy();
    await click(s.passkeyCreate);
    expect(screen.getByText(s.passkeyExpired)).toBeTruthy();
  });

  it("after a step-up asks to press Create again (a fresh click for the browser)", async () => {
    routes["POST /v1/me/mfa/passkeys/options"] = [needsStepUp, reply({ token: "tok", passkey: { publicKey: { challenge: "c" } } })];
    routes["POST /v1/me/reauth"] = reply(undefined);
    await show(on);
    await click(s.addPasskey);
    type(s.passkeyName, "Phone");
    await click(s.passkeyCreate);
    await confirmPassword();
    expect(await screen.findByText(s.passkeyConfirmedAgain)).toBeTruthy();
    expect(screen.getByLabelText(s.passkeyName)).toHaveProperty("value", "Phone");
    expect(webauthn.startRegistration).not.toHaveBeenCalled();
  });

  it("points to the key when the QR code cannot be drawn", async () => {
    routes["POST /v1/me/mfa/totp"] = reply(SETUP);
    requestBlob.mockRejectedValue(new ApiError(0, "network_error", "offline"));
    await show(off);
    await click(s.setUpApp);
    expect(await screen.findByText(s.qrFailed)).toBeTruthy();
    expect(screen.queryByRole("img", { name: s.qrAlt })).toBeNull();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
  });

  it("shows when the status cannot be loaded", async () => {
    routes["GET /v1/me/mfa"] = fail(0, "network_error");
    render(<TwoStep t={t} auth={auth} locale="vi" hasPassword />);
    expect(await screen.findByText(auth.errors.network)).toBeTruthy();
  });
});
