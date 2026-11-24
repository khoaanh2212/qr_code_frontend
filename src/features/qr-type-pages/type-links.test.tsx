// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { TypeLinks } from "./type-links";

afterEach(cleanup);

describe("TypeLinks", () => {
  it("links every type page in the current language", () => {
    render(<TypeLinks locale="vi" t={en} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(screen.getByRole("link", { name: "Wi-Fi" }).getAttribute("href")).toBe("/vi/wifi-qr-code");
  });

  it("marks the page being viewed instead of linking it to itself", () => {
    render(<TypeLinks locale="en" t={en} current="wifi" />);
    expect(screen.queryByRole("link", { name: "Wi-Fi" })).toBeNull();
    expect(screen.getByText("Wi-Fi").closest("[aria-current='page']")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("/vcard-qr-code");
  });
});
