// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { format } from "@/i18n/config";
import { RequireSession } from "@/features/auth/require-session";
import { en } from "@/i18n/messages/en";
import { ApiError, publicApi, sessionApi } from "@/lib/api";
import type { Campaign, CodeStats, DynamicCode, Folder } from "@/lib/api/types";
import { EMPTY_CAMPAIGN } from "./campaign/rules";
import { CodeInsights } from "./insights/code-insights";
import { CodeContent } from "./pages/code-content";
import { CodeDesign } from "./pages/code-design";
import { CodeForm } from "./code-form";
import { saveHandoff } from "./handoff";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ id: "c1" }),
}));

const t = en.codes;
const auth = en.auth;
const user = {
  id: "u1",
  email: "an@example.com",
  display_name: "An",
  role: "user" as const,
  email_verified: true,
  has_password: true,
  created_at: "2026-11-01T10:00:00Z",
};
const me = { user, workspaces: [{ id: "w1", name: "Personal", personal: true, role: "owner" }] };
const captcha = { siteKey: null, nonce: null, devToken: "dev-token" };
const code: DynamicCode = {
  id: "c1",
  short_code: "Ab3dE5gH",
  short_url: "http://localhost:8180/Ab3dE5gH",
  name: "Menu",
  target_url: "https://example.com/menu",
  design: { fg: "#000000", bg: "#ffffff" },
  status: "active",
  folder_id: null,
  campaign: EMPTY_CAMPAIGN,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
};
const days = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-11-${String(i + 1).padStart(2, "0")}`,
  scans: i === 29 ? 3 : 0,
  unique_scans: i === 29 ? 2 : 0,
}));
const stats: CodeStats = {
  from: "2026-11-01",
  to: "2026-11-30",
  scans: 3,
  bucket: "day",
  unique_scans_kind: "distinct_per_day",
  series: [],
  cities: [],
  daily: days,
  countries: [{ value: "VN", scans: 2 }], // the third scan has no known country
  devices: [{ value: "mobile", scans: 3 }],
  os: [],
  browsers: [],
};

let request: MockInstance<typeof sessionApi.request>;
let requestVoid: MockInstance<typeof sessionApi.requestVoid>;
let assign: ReturnType<typeof vi.fn>;

beforeAll(() => {
  // jsdom has <dialog> but not its modal API.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  push.mockReset();
  request = vi.spyOn(sessionApi, "request").mockImplementation(async (path) => {
    if (path === "/v1/me") return me;
    throw new Error(`unexpected ${path}`);
  });
  requestVoid = vi.spyOn(sessionApi, "requestVoid").mockResolvedValue();
  vi.spyOn(sessionApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  vi.spyOn(publicApi, "requestBlob").mockResolvedValue(new Blob(["png"], { type: "image/png" })); // the wizard's preview
  assign = vi.fn();
  vi.stubGlobal("location", { assign, replace: vi.fn(), pathname: "/app", search: "" });
  URL.createObjectURL = vi.fn(() => "blob:qr");
  URL.revokeObjectURL = vi.fn();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const withSession = (ui: React.ReactNode) => render(<RequireSession messages={en.session}>{ui}</RequireSession>);
const click = (name: string | RegExp) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));
// By role: the "Destination" section is labelled like its field.
const field = (name: string | RegExp) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const type = (name: string | RegExp, value: string) => fireEvent.change(field(name), { target: { value } });

describe("CodeForm", () => {
  const w = t.wizard;
  /** A creating button ignores clicks for a moment after a step change (double clicks): let it pass. */
  const settle = () => void vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
  const renderForm = () =>
    withSession(<CodeForm t={t} generator={en.generator} templates={en.templates} uploads={en.uploads} auth={auth} locale="en" captcha={captcha} />);
  const created = () => request.mock.calls.filter(([p, o]) => p === "/v1/workspaces/w1/codes" && o?.method === "POST").map(([, o]) => o?.body);
  const serveCreate = () =>
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return me;
      if (path === "/v1/workspaces/w1/codes" && opts?.method === "POST") return { code };
      if (path === "/v1/workspaces/w1/templates") return { templates: [] };
      throw new Error(`unexpected ${path}`);
    });
  const targetField = () => screen.findByRole("textbox", { name: new RegExp(t.target) }) as Promise<HTMLInputElement>;
  const step = () => screen.getByRole("list", { name: w.steps }).querySelector('[aria-current="step"]')?.textContent;

  it("starts at the destination with the handed-over address, and names both steps", async () => {
    saveHandoff({ url: "https://example.com/promo", fg: "#112233", bg: "#ffffff" });
    serveCreate();
    renderForm();
    const target = await targetField();
    await waitFor(() => expect(target.value).toBe("https://example.com/promo"));
    expect(sessionStorage.length).toBe(0); // read once
    expect(step()).toContain(w.stepDestination);
    expect(within(screen.getByRole("list", { name: w.steps })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: t.create })).toBeNull(); // creating is the last step
  });

  it("goes on to the design with its preview, creates the code there and returns to the list to greet it", async () => {
    saveHandoff({ url: "https://example.com/promo", fg: "#112233", bg: "#ffffff" });
    serveCreate();
    renderForm();
    await targetField();
    type(t.name, "  Promo  ");
    await click(w.next);
    expect(step()).toContain(w.stepDesign);
    expect(screen.getByRole("region", { name: w.previewTitle })).toBeTruthy();
    expect(screen.getByText(w.previewNote)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: new RegExp(t.target) })).toBeNull();
    expect(created()).toEqual([]); // nothing exists until the last button
    settle();
    await click(t.create);
    expect(created()).toEqual([
      { name: "Promo", target_url: "https://example.com/promo", design: { fg: "#112233", bg: "#ffffff" }, captcha_token: "dev-token" },
    ]);
    expect(push).toHaveBeenCalledWith("/app?ready=c1");
  });

  it("takes the second click of a double click on Next for what it is: nothing is created", async () => {
    serveCreate();
    renderForm();
    await targetField();
    type(new RegExp(t.target), "https://example.com/menu");
    await click(w.next);
    await click(t.create); // lands where "Next" was, a moment later
    expect(created()).toEqual([]);
    expect(step()).toContain(w.stepDesign);
    // And the same for Back, which "Create with the default design" replaces.
    await click(w.back);
    await click(w.skipDesign);
    expect(created()).toEqual([]);
  });

  it("does not create the code on Enter in a design field", async () => {
    serveCreate();
    renderForm();
    await targetField();
    type(new RegExp(t.target), "https://example.com/menu");
    await click(w.next);
    const color = screen.getByRole("textbox", { name: new RegExp(t.foreground) });
    expect(fireEvent.keyDown(color, { key: "Enter" })).toBe(false); // default prevented
    expect(created()).toEqual([]);
  });

  it("creates with the default design straight from the first step", async () => {
    serveCreate();
    renderForm();
    await targetField();
    type(new RegExp(t.target), "https://example.com/menu");
    await click(w.skipDesign);
    expect(created()).toEqual([{ name: "", target_url: "https://example.com/menu", design: { fg: "#000000", bg: "#ffffff" }, captcha_token: "dev-token" }]);
    expect(push).toHaveBeenCalledWith("/app?ready=c1");
  });

  it("creates a code that leads to a social profile, checked like the API first", async () => {
    serveCreate();
    renderForm();
    await targetField();
    fireEvent.click(screen.getByRole("radio", { name: en.generator.social.kindSocial }));
    fireEvent.change(screen.getByRole("combobox", { name: en.generator.fields.social.network.label }), { target: { value: "whatsapp" } });
    type(new RegExp(en.generator.social.phone), "12");
    await click(w.skipDesign);
    expect(created()).toEqual([]);
    expect(screen.getByText(t.errors.socialUsername)).toBeTruthy();
    expect(document.activeElement).toBe(field(new RegExp(en.generator.social.phone)));

    type(new RegExp(en.generator.social.phone), "+84 90 123 4567");
    type(en.generator.fields.social.text.label, "bell \u0007");
    await click(w.skipDesign);
    expect(created()).toEqual([]);
    expect(screen.getByText(t.errors.socialText)).toBeTruthy();
    expect(document.activeElement).toBe(field(en.generator.fields.social.text.label)); // the message, not the number

    type(en.generator.fields.social.text.label, " Xin chào ");
    expect(screen.getByText("https://wa.me/84901234567")).toBeTruthy();
    await click(w.skipDesign);
    expect(created()).toEqual([
      {
        name: "",
        social: { network: "whatsapp", username: "84901234567", text: "Xin chào" },
        design: { fg: "#000000", bg: "#ffffff" },
        captcha_token: "dev-token",
      },
    ]);
  });

  it("adds https:// and keeps what is not a web address on the first step, without calling the API", async () => {
    serveCreate();
    renderForm();
    const target = await targetField();
    type(new RegExp(t.target), "mailto:a@example.com");
    await click(w.next);
    expect(screen.getByText(t.errors.targetUrl)).toBeTruthy();
    expect(step()).toContain(w.stepDestination);
    expect(document.activeElement).toBe(target);
    await click(w.skipDesign);
    expect(created()).toEqual([]);

    type(new RegExp(t.target), "example.com");
    fireEvent.blur(target);
    expect(target.value).toBe("https://example.com");
  });

  it("keeps what was entered when going back, and resets the design on request", async () => {
    serveCreate();
    renderForm();
    await targetField();
    type(new RegExp(t.target), "https://example.com/menu");
    type(t.name, "Menu");
    await click(w.next);
    const color = screen.getByRole("textbox", { name: new RegExp(t.foreground) }) as HTMLInputElement;
    fireEvent.change(color, { target: { value: "#0f766e" } });
    fireEvent.blur(color);
    await click(w.back);
    expect((await targetField()).value).toBe("https://example.com/menu");
    expect(field(t.name).value).toBe("Menu");
    await click(w.next);
    expect((screen.getByRole("textbox", { name: new RegExp(t.foreground) }) as HTMLInputElement).value.toLowerCase()).toBe("#0f766e");
    await click(w.resetDesign);
    expect((screen.getByRole("textbox", { name: new RegExp(t.foreground) }) as HTMLInputElement).value.toLowerCase()).toBe("#000000");
  });

  it("shows the API's reason for refusing on the step it concerns", async () => {
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return me;
      if (path === "/v1/workspaces/w1/templates") return { templates: [] };
      if (opts?.method === "POST") throw new ApiError(403, "email_not_verified", "verify");
      throw new Error(`unexpected ${path}`);
    });
    renderForm();
    await targetField();
    type(new RegExp(t.target), "https://example.com");
    await click(w.next);
    settle();
    await click(t.create);
    // Among the alerts (the templates bar has its own), the form's says why.
    expect(screen.getAllByRole("alert").some((a) => a.textContent === t.errors.verifyFirst)).toBe(true);
    expect(step()).toContain(w.stepDesign);
    expect(push).not.toHaveBeenCalled();
  });

  it("returns to the destination when the API refuses the address", async () => {
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return me;
      if (path === "/v1/workspaces/w1/templates") return { templates: [] };
      if (opts?.method === "POST") throw new ApiError(422, "validation_error", "bad", "target_url");
      throw new Error(`unexpected ${path}`);
    });
    renderForm();
    await targetField();
    type(new RegExp(t.target), "https://example.com");
    await click(w.next);
    settle();
    await click(t.create);
    const target = await targetField();
    expect(step()).toContain(w.stepDestination);
    expect(screen.getByText(t.errors.targetUrl)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(target));
  });
});

describe("code pages", () => {
  const detailApi = (overrides: Partial<DynamicCode> = {}, folders: Folder[] = [], role: "owner" | "viewer" = "owner") =>
    request.mockImplementation(async (path, opts) => {
      if (path === "/v1/me") return { ...me, workspaces: [{ ...me.workspaces[0], role }] };
      if (path === "/v1/workspaces/w1/folders") return { folders };
      if (path === "/v1/workspaces/w1/templates") return { templates: [] };
      if (path === "/v1/workspaces/w1/codes/c1" && !opts?.method) return { code: { ...code, ...overrides } };
      if (path.startsWith("/v1/workspaces/w1/codes/c1/stats")) return stats;
      if (path === "/v1/workspaces/w1/codes/c1" && opts?.method === "PATCH") {
        const body = opts.body as Partial<DynamicCode> & { campaign?: Campaign | null };
        const before = { ...code, ...overrides };
        // Like the API: a null campaign clears the details, the object stays.
        return { code: { ...before, ...body, campaign: body.campaign === null ? EMPTY_CAMPAIGN : (body.campaign ?? before.campaign) } };
      }
      throw new Error(`unexpected ${path}`);
    });
  const patches = () => request.mock.calls.filter(([, o]) => o?.method === "PATCH").map(([, o]) => o?.body);
  const showInsights = async () => {
    withSession(<CodeInsights t={t} auth={auth} locale="en" />);
    await screen.findByRole("heading", { name: "Menu", level: 1 });
  };
  const moreActions = () => fireEvent.click(screen.getByRole("button", { name: format(t.pages.moreActions, { name: "Menu" }) }));
  const pick = (name: string) => act(async () => void fireEvent.click(screen.getByRole("menuitem", { name })));
  const said = () => screen.getAllByRole("status").map((s) => s.textContent);

  describe("the code's header on its insights page", () => {
    it("leads to the content page, downloads, and offers the rest in its menu", async () => {
      detailApi({}, [{ id: "f1", name: "Brunch", code_count: 1, created_at: code.created_at, updated_at: code.updated_at }]);
      await showInsights();
      expect(screen.getByRole("link", { name: t.pages.editContent }).getAttribute("href")).toBe("/app/codes/c1/edit");
      moreActions();
      expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
        t.pages.editDesign,
        t.pages.editShortLink,
        t.folders.move,
        t.pause,
        t.list.delete,
      ]);
      await pick(t.pages.editDesign);
      expect(push).toHaveBeenCalledWith("/app/codes/c1/design");
    });

    it("downloads the code from a dialog named for it", async () => {
      detailApi();
      await showInsights();
      await click(t.download);
      const dialog = screen.getByRole("dialog", { name: t.pages.downloadTitle });
      const blobs = vi.spyOn(sessionApi, "requestBlob");
      blobs.mockClear();
      await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: t.list.downloadSvg })));
      expect(blobs).toHaveBeenCalledWith(expect.stringContaining("/codes/c1/image?format=svg"));
    });

    it("pauses and resumes the code from its menu, and says so", async () => {
      detailApi();
      await showInsights();
      moreActions();
      await pick(t.pause);
      expect(patches()).toEqual([{ status: "paused" }]);
      expect(said()).toContain(t.pausedIntro);
      moreActions();
      expect(screen.getByRole("menuitem", { name: t.resume })).toBeTruthy();
    });

    it("moves the code into a folder through the folder dialog, and shows the folder", async () => {
      detailApi({}, [{ id: "f1", name: "Brunch", code_count: 0, created_at: code.created_at, updated_at: code.updated_at }]);
      await showInsights();
      expect(screen.getByText(t.pages.noFolder)).toBeTruthy();
      moreActions();
      await pick(t.folders.move);
      const dialog = screen.getByRole("dialog");
      fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "f1" } });
      await act(async () => void fireEvent.click(within(dialog).getByRole("button", { name: t.folders.moveConfirm })));
      expect(patches()).toEqual([{ folder_id: "f1" }]);
      expect(said()).toContain(format(t.folders.movedOne, { folder: "Brunch" }));
      await waitFor(() => expect(screen.getByText("Brunch")).toBeTruthy());
    });

    it("deletes only after confirming, then returns to the list", async () => {
      detailApi();
      await showInsights();
      moreActions();
      await pick(t.list.delete);
      expect(requestVoid).not.toHaveBeenCalled();
      await act(async () => void fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t.deleteConfirm })));
      expect(requestVoid).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", { method: "DELETE" });
      expect(push).toHaveBeenCalledWith("/app");
    });

    it("keeps a locked code's changes out of reach, but not its download or deletion", async () => {
      detailApi({ status: "locked" });
      await showInsights();
      expect(screen.queryByRole("link", { name: t.pages.editContent })).toBeNull();
      moreActions();
      expect(screen.getAllByRole("menuitem").map((m) => m.textContent)).toEqual([t.list.delete]);
      expect(screen.getByRole("button", { name: t.download })).toBeTruthy();
    });

    it("gives viewers the download only", async () => {
      detailApi({}, [], "viewer");
      await showInsights();
      expect(screen.queryByRole("link", { name: t.pages.editContent })).toBeNull();
      expect(screen.queryByRole("button", { name: format(t.pages.moreActions, { name: "Menu" }) })).toBeNull();
      expect(screen.getByRole("button", { name: t.download })).toBeTruthy();
    });
  });

  describe("short link", () => {
    const origin = "http://localhost:8180/";
    const open = async () => {
      await showInsights();
      moreActions();
      await pick(t.pages.editShortLink);
    };
    const dialog = () => within(screen.getByRole("dialog", { name: t.pages.editShortLink }));
    const save = () => act(async () => void fireEvent.click(dialog().getByRole("button", { name: t.save })));

    it("opens a dialog with the origin before the field, focused in an empty field", async () => {
      detailApi();
      await open();
      const input = dialog().getByRole("textbox", { name: t.slugLabel }) as HTMLInputElement;
      expect(input.value).toBe("");
      expect(document.activeElement).toBe(input);
      expect(dialog().getByText(origin)).toBeTruthy();
    });

    it("closes on Cancel and on Escape without calling the API", async () => {
      detailApi();
      await open();
      await act(async () => void fireEvent.click(dialog().getByRole("button", { name: t.cancel })));
      expect(screen.queryByRole("dialog")).toBeNull();
      moreActions();
      await pick(t.pages.editShortLink);
      fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(patches()).toEqual([]);
    });

    it("refuses an invalid slug on its field, without calling the API", async () => {
      detailApi();
      await open();
      fireEvent.change(dialog().getByRole("textbox", { name: t.slugLabel }), { target: { value: "Mario--Pizza" } });
      await save();
      expect(patches()).toEqual([]);
      expect(dialog().getByRole("textbox", { name: t.slugLabel }).getAttribute("aria-invalid")).toBe("true");
    });

    it("saves the trimmed slug, closes, shows the new link and says so", async () => {
      detailApi();
      await open();
      fireEvent.change(dialog().getByRole("textbox", { name: t.slugLabel }), { target: { value: "  my-shop " } });
      request.mockImplementationOnce(async () => ({ code: { ...code, short_code: "my-shop", short_url: `${origin}my-shop` } }));
      await save();
      expect(request).toHaveBeenCalledWith("/v1/workspaces/w1/codes/c1", { method: "PATCH", body: { short_code: "my-shop" } });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("localhost:8180/my-shop")).toBeTruthy();
      expect(said()).toContain(t.linkSaved);
    });

    it("goes to the login page on 401", async () => {
      detailApi();
      await open();
      fireEvent.change(dialog().getByRole("textbox", { name: t.slugLabel }), { target: { value: "my-shop" } });
      request.mockRejectedValueOnce(new ApiError(401, "unauthorized", "x"));
      await save();
      expect(window.location.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });
  });

  describe("content page", () => {
    const showContent = async () => {
      withSession(<CodeContent t={t} generator={en.generator} auth={auth} locale="en" />);
      await screen.findByRole("heading", { name: t.pages.contentTitle, level: 1 });
    };

    it("changes the destination and the name, and says so", async () => {
      detailApi();
      await showContent();
      expect(screen.getByRole("link", { name: `← ${t.pages.backToCode}` }).getAttribute("href")).toBe("/app/codes/c1/insights");
      type(new RegExp(t.target), "https://example.com/new-menu");
      type(t.name, "  Brunch menu ");
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([{ name: "Brunch menu", target_url: "https://example.com/new-menu" }]);
      expect(screen.getByText(t.saved)).toBeTruthy();
    });

    it("saves nothing when nothing changed, and keeps what is not a web address on its field", async () => {
      detailApi();
      await showContent();
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([]);
      expect(screen.getByText(t.saved)).toBeTruthy();
      type(new RegExp(t.target), "mailto:a@example.com");
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([]);
      expect(screen.getByText(t.errors.targetUrl)).toBeTruthy();
      expect(document.activeElement).toBe(field(new RegExp(t.target)));
    });

    it("shows the API's reason for refusing", async () => {
      detailApi();
      await showContent();
      type(new RegExp(t.target), "https://example.com/x");
      request.mockRejectedValueOnce(new ApiError(403, "email_not_verified", "verify"));
      await click(t.pages.saveChanges);
      expect(screen.getAllByRole("alert").some((a) => a.textContent === t.errors.verifyFirst)).toBe(true);
    });

    it("is read-only, with why, for a locked code and for viewers", async () => {
      detailApi({ status: "locked" });
      await showContent();
      expect(screen.getByText(t.lockedIntro)).toBeTruthy();
      expect(field(new RegExp(t.target)).matches(":disabled")).toBe(true); // via the fieldset
      expect(screen.queryByRole("button", { name: t.pages.saveChanges })).toBeNull();
      cleanup();
      detailApi({}, [], "viewer");
      await showContent();
      expect(screen.getByText(t.pages.viewerNote)).toBeTruthy();
      expect(screen.queryByRole("button", { name: t.pages.saveChanges })).toBeNull();
    });

    it("opens a preset link as its preset and saves a changed username as a preset", async () => {
      detailApi({ target_url: "https://www.instagram.com/proof.qr/" });
      await showContent();
      expect((screen.getByRole("radio", { name: en.generator.social.kindSocial }) as HTMLInputElement).checked).toBe(true);
      expect(field(new RegExp(en.generator.fields.social.username.label)).value).toBe("proof.qr");
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([]); // still the same link
      type(new RegExp(en.generator.fields.social.username.label), "@proof_qr");
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([{ social: { network: "instagram", username: "proof_qr" } }]);
    });

    it("puts the API's refusal of a social username on its field", async () => {
      detailApi({ target_url: "https://www.tiktok.com/@proof_qr" });
      await showContent();
      type(new RegExp(en.generator.fields.social.username.label), "other_qr");
      request.mockRejectedValueOnce(new ApiError(422, "validation_error", "bad", "social.username"));
      await click(t.pages.saveChanges);
      expect(screen.getByText(t.errors.socialUsername)).toBeTruthy();
      expect(document.activeElement).toBe(field(new RegExp(en.generator.fields.social.username.label)));
    });

    it("turns a website address into a social preset", async () => {
      detailApi();
      await showContent();
      fireEvent.click(screen.getByRole("radio", { name: en.generator.social.kindSocial }));
      fireEvent.change(screen.getByRole("combobox", { name: en.generator.fields.social.network.label }), { target: { value: "youtube" } });
      type(new RegExp(en.generator.fields.social.username.label), "proof-qr");
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([{ social: { network: "youtube", username: "proof-qr" } }]);
    });

    it("says when the code does not exist", async () => {
      request.mockImplementation(async (path) => {
        if (path === "/v1/me") return me;
        throw new ApiError(404, "not_found", "gone");
      });
      withSession(<CodeContent t={t} generator={en.generator} auth={auth} locale="en" />);
      expect(await screen.findByText(t.notFound)).toBeTruthy();
    });
  });

  describe("design page", () => {
    const showDesign = async () => {
      withSession(<CodeDesign t={t} generator={en.generator} templates={en.templates} uploads={en.uploads} auth={auth} locale="en" />);
      await screen.findByRole("heading", { name: t.designTitle, level: 1 });
    };
    const color = () => screen.getByRole("textbox", { name: new RegExp(t.foreground) }) as HTMLInputElement;

    it("draws the code itself as the preview, saves the new design and says so", async () => {
      detailApi();
      const drawn = vi.spyOn(publicApi, "requestBlob");
      await showDesign();
      expect(screen.getByRole("region", { name: t.wizard.previewTitle })).toBeTruthy();
      fireEvent.change(color(), { target: { value: "#0f766e" } });
      fireEvent.blur(color());
      await waitFor(() => expect(drawn).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(code.short_url)), expect.anything()));
      await click(t.pages.saveChanges);
      expect(patches()).toEqual([{ design: { fg: "#0f766e", bg: "#ffffff" } }]);
      expect(screen.getByText(t.saved)).toBeTruthy();
    });

    it("puts the saved design back on Reset", async () => {
      detailApi();
      await showDesign();
      fireEvent.change(color(), { target: { value: "#0f766e" } });
      fireEvent.blur(color());
      await click(t.wizard.resetDesign);
      expect(color().value.toLowerCase()).toBe("#000000");
    });

    it("is read-only for a locked code", async () => {
      detailApi({ status: "locked" });
      await showDesign();
      expect(screen.getByText(t.lockedIntro)).toBeTruthy();
      expect(color().matches(":disabled")).toBe(true);
      expect(screen.queryByRole("button", { name: t.pages.saveChanges })).toBeNull();
    });
  });

  describe("campaign", () => {
    const c = t.campaign;
    const full: Campaign = { start_date: "2026-12-01", end_date: "2026-12-31", print_run: 5000, medium: "poster", medium_other: null };
    const open = async (overrides: Partial<DynamicCode> = {}, role: "owner" | "viewer" = "owner") => {
      detailApi(overrides, [], role);
      withSession(<CodeInsights t={t} auth={auth} locale="en" />);
      await screen.findByRole("heading", { name: "Menu", level: 1 });
    };
    const section = () => within(screen.getByRole("region", { name: c.title }));
    const input = (label: string) => section().getByLabelText(label) as HTMLInputElement;
    const set = (label: string, value: string) => fireEvent.change(input(label), { target: { value } });
    const medium = () => section().getByRole("combobox", { name: c.medium }) as HTMLSelectElement;
    const patches = () => request.mock.calls.filter(([, o]) => o?.method === "PATCH").map(([, o]) => o?.body);
    // Scoped to the section: the page has other Save and Cancel buttons.
    const press = (name: string) => act(async () => void fireEvent.click(section().getByRole("button", { name })));
    const save = () => press(t.save);
    // The messages shown: field errors and the form alert (whose live region stays rendered when empty).
    const alerts = () =>
      section()
        .getAllByRole("alert")
        .map((a) => a.textContent)
        .filter(Boolean);

    it("says there are no details yet and offers to add them", async () => {
      await open();
      expect(section().getByText(c.empty)).toBeTruthy();
      expect(section().getByRole("button", { name: c.add })).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
    });

    it("shows the details with dates and numbers in the reader's format", async () => {
      await open({ campaign: { ...full, medium: "other", medium_other: "Trade fair" } });
      const list = section();
      expect(list.getByText("Dec 1, 2026")).toBeTruthy();
      expect(list.getByText("Dec 31, 2026")).toBeTruthy();
      expect(list.getByText("5,000")).toBeTruthy();
      expect(list.getByText("Trade fair")).toBeTruthy();
      expect(list.getByRole("button", { name: c.edit })).toBeTruthy();
    });

    it("shows what is not set, and a medium by its name", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, medium: "business_card" } });
      expect(section().getByText(c.media.business_card)).toBeTruthy();
      expect(section().getAllByText(c.notSet)).toHaveLength(3);
    });

    it("groups the media into print and digital, with not set first and other last", async () => {
      await open();
      await press(c.add);
      const select = medium();
      expect(select.value).toBe("");
      expect([...select.querySelectorAll("optgroup")].map((g) => g.label)).toEqual([c.groupPrint, c.groupDigital]);
      const options = within(select).getAllByRole("option").map((o) => o.textContent);
      expect(options).toHaveLength(19);
      expect(options[0]).toBe(c.mediumNone);
      expect(options[1]).toBe(c.media.poster);
      expect(options[13]).toBe(c.media.website);
      expect(options[18]).toBe(c.media.other);
    });

    it("saves the whole campaign, shows it and returns focus to Edit", async () => {
      await open();
      await press(c.add);
      expect(document.activeElement).toBe(input(c.start));
      set(c.start, "2026-12-01");
      set(c.end, "2026-12-31");
      set(c.printRun, "5000");
      fireEvent.change(medium(), { target: { value: "poster" } });
      await save();
      expect(patches()).toEqual([{ campaign: full }]);
      expect(section().getByText(c.saved)).toBeTruthy();
      expect(section().getByText(c.media.poster)).toBeTruthy();
      expect(section().queryByLabelText(c.start)).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.edit })));
    });

    it("asks which medium only for other, without moving focus, and requires an answer", async () => {
      await open();
      await press(c.add);
      expect(section().queryByLabelText(c.otherLabel)).toBeNull();
      medium().focus();
      await act(async () => void fireEvent.change(medium(), { target: { value: "other" } }));
      expect(input(c.otherLabel)).toBeTruthy();
      expect(document.activeElement).toBe(medium()); // arrowing through the list must not throw the reader out of it
      await save();
      expect(patches()).toEqual([]);
      expect(alerts()).toEqual([c.errors.otherRequired]);
      expect(input(c.otherLabel).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(input(c.otherLabel));
      set(c.otherLabel, "  Trade   fair ");
      await save();
      expect(patches()).toEqual([{ campaign: { ...EMPTY_CAMPAIGN, medium: "other", medium_other: "Trade fair" } }]);
    });

    it("refuses an end before the start without calling the API", async () => {
      await open({ campaign: full });
      await press(c.edit);
      expect(input(c.start).value).toBe("2026-12-01");
      expect(input(c.end).min).toBe("2026-12-01");
      set(c.end, "2026-11-30");
      await save();
      expect(patches()).toEqual([]);
      expect(alerts()).toEqual([c.errors.endBeforeStart]);
      expect(document.activeElement).toBe(input(c.end));
    });

    it("refuses a print run that is not a whole number in range, naming the range", async () => {
      await open();
      await press(c.add);
      set(c.printRun, "1e5");
      await save();
      expect(patches()).toEqual([]);
      expect(alerts()).toEqual([format(c.errors.printRun, { min: "1", max: "100,000,000" })]);
    });

    it("closes without a request when nothing changed", async () => {
      await open({ campaign: full });
      await press(c.edit);
      await save();
      expect(patches()).toEqual([]);
      expect(section().queryByLabelText(c.start)).toBeNull();
      expect(section().queryByText(c.saved)).toBeNull();
    });

    it("cancels with the button and with Escape, keeping the details and returning focus", async () => {
      await open({ campaign: full });
      await press(c.edit);
      set(c.printRun, "9");
      await press(t.cancel);
      expect(patches()).toEqual([]);
      expect(section().getByText("5,000")).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.edit })));
      await press(c.edit);
      expect(input(c.printRun).value).toBe("5000"); // the abandoned edit is gone
      await act(async () => void fireEvent.keyDown(input(c.printRun), { key: "Escape" }));
      expect(section().queryByLabelText(c.printRun)).toBeNull();
    });

    it("clears every field to null when the form is emptied", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, print_run: 12 } });
      await press(c.edit);
      set(c.printRun, "");
      await save();
      expect(patches()).toEqual([{ campaign: null }]);
      expect(section().getByText(c.removed)).toBeTruthy();
      expect(section().getByText(c.empty)).toBeTruthy();
    });

    it("removes all details only after confirming", async () => {
      await open({ campaign: full });
      await press(c.edit);
      await press(c.remove);
      expect(patches()).toEqual([]);
      expect(section().getByText(c.removeConfirm)).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: t.cancel })));
      await press(t.cancel); // back to the form, nothing removed
      expect(input(c.printRun).value).toBe("5000");
      await press(c.remove);
      await press(c.removeYes);
      expect(patches()).toEqual([{ campaign: null }]);
      expect(section().getByText(c.removed)).toBeTruthy();
      expect(section().getByRole("button", { name: c.add })).toBeTruthy();
    });

    it("offers no removal while there is nothing to remove", async () => {
      await open();
      await press(c.add);
      expect(section().queryByRole("button", { name: c.remove })).toBeNull();
    });

    it("puts the API's refusal on its field", async () => {
      await open();
      await press(c.add);
      set(c.end, "2026-12-31");
      request.mockRejectedValueOnce(new ApiError(422, "validation_error", "bad", "campaign.end_date"));
      await save();
      expect(alerts()).toEqual([c.errors.dateRange]);
      expect(input(c.end).getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(input(c.end));
    });

    it("says so when the code was locked meanwhile, and turns read-only", async () => {
      await open({ campaign: full });
      await press(c.edit);
      set(c.printRun, "6000");
      request.mockImplementation(async (path, opts) => {
        if (path === "/v1/workspaces/w1/codes/c1" && opts?.method === "PATCH") throw new ApiError(409, "code_locked", "locked");
        if (path === "/v1/workspaces/w1/codes/c1") return { code: { ...code, campaign: full, status: "locked" } };
        if (path.startsWith("/v1/workspaces/w1/codes/c1/stats")) return stats;
        if (path === "/v1/workspaces/w1/folders") return { folders: [] };
        return me;
      });
      await save();
      await waitFor(() => expect(section().queryByLabelText(c.printRun)).toBeNull());
      expect(alerts()).toEqual([t.errors.locked]);
      expect(section().getByText("5,000")).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
      const region = screen.getByRole("region", { name: c.title });
      await waitFor(() => expect(region.contains(document.activeElement)).toBe(true)); // not dropped to <body>
    });

    it("goes to the login page on 401", async () => {
      await open();
      await press(c.add);
      set(c.printRun, "5");
      request.mockRejectedValueOnce(new ApiError(401, "unauthorized", "no session"));
      await save();
      expect(window.location.replace).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });

    it("sends one request when saved twice while busy", async () => {
      await open();
      await press(c.add);
      set(c.printRun, "5");
      let finish: (v: unknown) => void = () => {};
      request.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      const button = section().getByRole("button", { name: t.save });
      await act(async () => {
        fireEvent.click(button);
        fireEvent.click(button);
      });
      expect(patches()).toHaveLength(1);
      await act(async () => finish({ code: { ...code, campaign: { ...EMPTY_CAMPAIGN, print_run: 5 } } }));
      expect(section().getByText(c.saved)).toBeTruthy();
    });

    it("keeps the form open while a save is running: Cancel, Escape and the medium wait", async () => {
      await open({ campaign: full });
      await press(c.edit);
      set(c.printRun, "6000");
      let finish: (v: unknown) => void = () => {};
      let fail: (e: unknown) => void = () => {};
      request.mockImplementationOnce(() => new Promise((resolve, reject) => ((finish = resolve), (fail = reject))));
      await save();
      await press(t.cancel);
      await act(async () => void fireEvent.keyDown(input(c.printRun), { key: "Escape" }));
      fireEvent.change(medium(), { target: { value: "flyer" } });
      expect(input(c.printRun).value).toBe("6000"); // still the form, still what was sent
      expect(medium().value).toBe("poster");
      await act(async () => fail(new ApiError(500, "internal_error", "boom")));
      expect(alerts()).toEqual([t.errors.generic]); // the failure reaches the reader
      expect(patches()).toHaveLength(1);
      void finish;
    });

    it("leaves the form alone on Escape while a text is being composed", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, medium: "other", medium_other: "Fair" } });
      await press(c.edit);
      expect(document.activeElement).toBe(input(c.start)); // "other" already chosen: no focus jump on opening
      await act(async () => void fireEvent.keyDown(input(c.otherLabel), { key: "Escape", isComposing: true }));
      expect(input(c.otherLabel).value).toBe("Fair");
    });

    it("names the confirmation, leaves it on Escape, and returns to the form with focus when removing fails", async () => {
      await open({ campaign: full });
      await press(c.edit);
      await press(c.remove);
      const step = section().getByRole("group", { name: c.removeConfirm });
      await act(async () => void fireEvent.keyDown(step, { key: "Escape" }));
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.remove })));
      expect(patches()).toEqual([]);
      await press(c.remove);
      request.mockRejectedValueOnce(new ApiError(500, "internal_error", "boom"));
      await press(c.removeYes);
      expect(alerts()).toEqual([t.errors.generic]);
      expect(input(c.printRun).value).toBe("5000");
      await waitFor(() => expect(document.activeElement).toBe(section().getByRole("button", { name: c.remove })));
    });

    it("shows a medium this version does not know by its API name", async () => {
      await open({ campaign: { ...EMPTY_CAMPAIGN, medium: "podcast" as Campaign["medium"] } });
      expect(section().getByText("podcast")).toBeTruthy();
    });

    it("treats a code from an API without campaigns as having none", async () => {
      await open({ campaign: undefined as unknown as Campaign });
      expect(section().getByText(c.empty)).toBeTruthy();
      await press(c.add);
      set(c.printRun, "7");
      await save();
      expect(patches()).toEqual([{ campaign: { ...EMPTY_CAMPAIGN, print_run: 7 } }]);
    });

    it("is read-only for viewers and on a locked code", async () => {
      await open({ campaign: full }, "viewer");
      expect(section().getByText("5,000")).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
      cleanup();
      await open({}, "viewer");
      expect(section().getByText(c.empty)).toBeTruthy();
      expect(section().queryByRole("button", { name: c.add })).toBeNull();
      cleanup();
      await open({ campaign: full, status: "locked" });
      expect(section().getByText(c.media.poster)).toBeTruthy();
      expect(section().queryByRole("button", { name: c.edit })).toBeNull();
    });
  });

});
