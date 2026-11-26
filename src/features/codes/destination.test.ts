import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { ApiError } from "@/lib/api";
import { destinationChanges, destinationFor, initialDestination, type DestinationState } from "./destination";
import { codeFailure } from "./errors";

const t = en.codes;
const url = (u: string): DestinationState => ({ ...initialDestination(""), url: u });
const social = (network: DestinationState["link"]["network"], username: string, text = ""): DestinationState => ({
  kind: "social",
  url: "",
  link: { network, username, text },
});

describe("destinationFor (what a new code is sent)", () => {
  it("sends a website address, completed with https://", () => {
    expect(destinationFor(url("example.com/menu"), t)).toEqual({ ok: true, body: { target_url: "https://example.com/menu" }, url: "https://example.com/menu" });
  });

  it("refuses an address without http(s)", () => {
    expect(destinationFor(url("ftp://x"), t)).toEqual({ ok: false, field: "target_url", message: t.errors.targetUrl });
  });

  it("sends a social preset instead of an address, normalized as the API reads it", () => {
    expect(destinationFor(social("instagram", " @proof.qr "), t)).toEqual({
      ok: true,
      body: { social: { network: "instagram", username: "proof.qr" } },
      url: "https://www.instagram.com/proof.qr/",
    });
    expect(destinationFor(social("whatsapp", "+84 90 123 4567", " Hi "), t)).toMatchObject({
      body: { social: { network: "whatsapp", username: "84901234567", text: "Hi" } },
    });
  });

  it("drops a message left over from WhatsApp for another network", () => {
    expect(destinationFor(social("tiktok", "proof_qr", "hello"), t)).toMatchObject({ body: { social: { network: "tiktok", username: "proof_qr" } } });
  });

  it("says which social field is wrong", () => {
    expect(destinationFor(social("facebook", "abc"), t)).toEqual({ ok: false, field: "social.username", message: t.errors.socialUsername });
    expect(destinationFor(social("youtube", ""), t)).toEqual({ ok: false, field: "social.username", message: t.errors.socialUsername });
    expect(destinationFor(social("whatsapp", "84901234567", "a\u0000"), t)).toEqual({ ok: false, field: "social.text", message: t.errors.socialText });
  });
});

describe("initialDestination (the edit page)", () => {
  it("opens a preset link as its preset", () => {
    expect(initialDestination("https://wa.me/84901234567?text=Xin%20ch%C3%A0o")).toEqual({
      kind: "social",
      url: "https://wa.me/84901234567?text=Xin%20ch%C3%A0o",
      link: { network: "whatsapp", username: "84901234567", text: "Xin chào" },
    });
  });

  it("opens any other link as a website address", () => {
    expect(initialDestination("https://example.com/")).toEqual({
      kind: "url",
      url: "https://example.com/",
      link: { network: "instagram", username: "", text: "" },
    });
  });
});

describe("destinationChanges (what an edit sends)", () => {
  it("sends nothing while the preset still builds the stored link", () => {
    const d = initialDestination("https://www.tiktok.com/@proof_qr");
    expect(destinationChanges(d, "https://www.tiktok.com/@proof_qr", t)).toEqual({ ok: true, changes: {} });
    expect(destinationChanges({ ...d, link: { ...d.link, username: "@proof_qr" } }, "https://www.tiktok.com/@proof_qr", t)).toEqual({ ok: true, changes: {} });
  });

  it("sends the preset when it builds another link, and an address when that changed", () => {
    const d = initialDestination("https://www.tiktok.com/@proof_qr");
    expect(destinationChanges({ ...d, link: { ...d.link, username: "other_qr" } }, "https://www.tiktok.com/@proof_qr", t)).toEqual({
      ok: true,
      changes: { social: { network: "tiktok", username: "other_qr" } },
    });
    expect(destinationChanges({ ...d, kind: "url", url: "https://example.com" }, "https://www.tiktok.com/@proof_qr", t)).toEqual({
      ok: true,
      changes: { target_url: "https://example.com" },
    });
  });
});

describe("codeFailure for social fields", () => {
  it("puts the API's social refusals on their field", () => {
    const err = (field: string) => new ApiError(422, "validation_error", "bad", field);
    expect(codeFailure(err("social.username"), t, en.auth)).toEqual({ field: "social.username", message: t.errors.socialUsername });
    expect(codeFailure(err("social.text"), t, en.auth)).toEqual({ field: "social.text", message: t.errors.socialText });
    expect(codeFailure(err("social.network"), t, en.auth)).toEqual({ field: "social.username", message: t.errors.socialUsername });
  });
});
