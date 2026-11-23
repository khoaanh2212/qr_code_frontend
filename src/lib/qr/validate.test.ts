import { describe, expect, it } from "vitest";
import { downloadName, normalizeUrlInput, validateFields } from "./validate";
import type { QrType } from "./types";

const types: Record<string, QrType> = {
  url: { type: "url", fields: [{ name: "url", required: true }] },
  wifi: {
    type: "wifi",
    fields: [
      { name: "ssid", required: true },
      { name: "password", required: false },
      { name: "encryption", required: false, options: ["WPA", "WEP", "nopass"] },
    ],
  },
  vcard: {
    type: "vcard",
    fields: [
      { name: "first_name", required: false },
      { name: "phone", required: false },
      { name: "email", required: false },
      { name: "website", required: false },
    ],
  },
};

describe("validateFields", () => {
  it.each([
    ["https://example.com/a?b=1", undefined],
    ["http://localhost:8080", undefined],
    ["example.com", "url"],
    ["ftp://example.com", "url"],
    ["javascript:alert(1)", "url"],
    ["https://", "url"],
    ["http:///x", "url"],
    ["http:////x", "url"],
    ["https://exa\u0007mple.com", "url"],
    ["  https://example.com  ", undefined],
  ])("url %j", (url, want) => {
    expect(validateFields(types.url, { url }).url).toBe(want);
  });

  it("checks Wi-Fi as the API does", () => {
    const v = (data: Record<string, string>) => validateFields(types.wifi, data);
    expect(v({ ssid: "a".repeat(32), encryption: "WPA", password: "12345678" })).toEqual({});
    expect(v({ ssid: "ặ".repeat(11), encryption: "WPA", password: "12345678" }).ssid).toBe("ssidBytes"); // 33 bytes
    expect(v({ ssid: "Office", encryption: "WPA", password: "short" }).password).toBe("wpa");
    expect(v({ ssid: "Office", encryption: "WPA", password: "z".repeat(64) }).password).toBe("wpa");
    expect(v({ ssid: "Office", encryption: "WPA", password: "ab".repeat(32) })).toEqual({});
    expect(v({ ssid: "Office", encryption: "WEP", password: "x" })).toEqual({});
    // Empty WPA/WEP passwords are missingRequired's job; an open network's password is dropped.
    expect(v({ ssid: "Office", encryption: "WPA", password: "" })).toEqual({});
    expect(v({ ssid: "Office", encryption: "nopass", password: "x" })).toEqual({});
  });

  it("checks phone, email and website fields wherever they appear", () => {
    const out = validateFields(types.vcard, {
      first_name: "An",
      phone: "+84 (912) 345-678",
      email: "an@example",
      website: "example.com",
    });
    expect(out).toEqual({ email: "email", website: "url" });
    expect(validateFields(types.vcard, { first_name: "An", phone: "12" }).phone).toBe("phone");
    expect(validateFields(types.vcard, { first_name: "An", phone: " 84912" }).phone).toBe("phone");
    expect(validateFields(types.vcard, { first_name: "An", email: "a?bcc=x@example.com" }).email).toBe("email");
    for (const email of ["a..b@x.com", ".a@x.com", "a.@x.com", "a@-x.com", "a@x-.com"]) {
      expect(validateFields(types.vcard, { first_name: "An", email }).email, email).toBe("email");
    }
    expect(validateFields(types.vcard, { first_name: "An", email: "  a.b@x.com " })).toEqual({});
    expect(validateFields(types.vcard, { first_name: "An", phone: "84\t912345" }).phone).toBe("phone");
  });

  it("ignores empty optional fields", () => {
    expect(validateFields(types.vcard, { first_name: "An", phone: "", email: "  " })).toEqual({});
  });
});

describe("normalizeUrlInput", () => {
  it.each([
    ["example.com", "https://example.com"],
    ["  example.com/menu ", "https://example.com/menu"],
    ["https://example.com", "https://example.com"],
    ["HTTP://x.org", "HTTP://x.org"],
    ["javascript:alert(1)", "javascript:alert(1)"],
    ["not a url", "not a url"],
    ["user@example.com", "user@example.com"],
    ["example.com:8080/x", "https://example.com:8080/x"],
    ["", ""],
  ])("%j -> %j", (input, want) => {
    expect(normalizeUrlInput(input)).toBe(want);
  });
});

describe("downloadName", () => {
  it.each([
    ["url", { url: "https://www.Example.com/menu" }, "qr-example-com"],
    ["wifi", { ssid: "Văn phòng Đà Nẵng" }, "qr-wifi-van-phong-da-nang"],
    ["vcard", { first_name: "Thị", last_name: "Nguyễn" }, "qr-thi-nguyen"],
    ["vcard", { organization: "ACME & Co." }, "qr-acme-co"],
    ["email", { to: "sales@example.com" }, "qr-email-sales"],
    ["phone", { phone: "+84 912 345 678" }, "qr-tel-84912345678"],
    ["text", { text: "Hello there, world and more words" }, "qr-hello-there-world"],
    ["url", { url: "not a url" }, "qr-code-url"],
    ["wifi", { ssid: "🙂🙂" }, "qr-code-wifi"],
  ])("%s %j -> %s", (type, data, want) => {
    expect(downloadName(type, data)).toBe(want);
  });
});
