// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { TypeFooterLinks, TypeLinks } from "./type-links";

afterEach(cleanup);

describe("TypeLinks", () => {
  it("links every type page in the current language, with the type's search phrase as anchor", () => {
    render(<TypeLinks locale="vi" t={en.typePages} />);
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: "Wi-Fi QR code" }).getAttribute("href")).toBe("/vi/wifi-qr-code");
  });

  it("marks the page being viewed instead of linking it to itself", () => {
    render(<TypeLinks locale="en" t={en.typePages} current="wifi" />);
    expect(screen.queryByRole("link", { name: "Wi-Fi QR code" })).toBeNull();
    expect(screen.getByText("Wi-Fi QR code").closest("[aria-current='page']")).toBeTruthy();
    expect(screen.getByRole("link", { name: "vCard QR code" }).getAttribute("href")).toBe("/vcard-qr-code");
  });
});

describe("TypeLinks with TypeFooterLinks on one page", () => {
  it("exposes a single navigation landmark for the type links", () => {
    render(
      <>
        <TypeLinks locale="en" t={en.typePages} current="sms" />
        <TypeFooterLinks locale="en" t={en.typePages} />
      </>,
    );
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("region", { name: en.typePages.allTypes })).toBeTruthy();
  });
});

describe("TypeFooterLinks", () => {
  it("lists every type page under its own labelled navigation", () => {
    render(<TypeFooterLinks locale="de" t={en.typePages} />);
    const nav = screen.getByRole("navigation", { name: en.typePages.allTypes });
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/de/url-qr-code",
      "/de/text-qr-code",
      "/de/wifi-qr-code",
      "/de/vcard-qr-code",
      "/de/email-qr-code",
      "/de/sms-qr-code",
      "/de/phone-qr-code",
    ]);
  });
});
