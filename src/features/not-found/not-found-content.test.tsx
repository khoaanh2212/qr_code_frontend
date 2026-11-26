// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NOT_FOUND_MESSAGES } from "@/i18n/not-found";
import { NotFoundContent } from "./not-found-content";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

const at = (pathname: string) => window.history.replaceState(null, "", pathname);

describe("404 page", () => {
  it("says the page is missing in the URL's language and leads to the generator and the codes", () => {
    at("/vi/khong-co");
    render(<NotFoundContent />);
    const t = NOT_FOUND_MESSAGES.vi;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t.heading);
    expect(screen.getByText(t.lead)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.create }).getAttribute("href")).toBe("/vi");
    expect(screen.getByRole("link", { name: t.codes }).getAttribute("href")).toBe("/vi/app");
    expect(document.documentElement.lang).toBe("vi");
    expect(document.title).toBe(t.title);
  });

  it("has the site's header and footer around it", () => {
    at("/nope");
    render(<NotFoundContent />);
    const t = NOT_FOUND_MESSAGES.en;
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: t.home }).getAttribute("href")).toBe("/");
    expect(within(header).getByRole("link", { name: t.login }).getAttribute("href")).toBe("/login");
    expect(within(header).getByRole("link", { name: t.signup }).getAttribute("href")).toBe("/register");
    expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: t.report }).getAttribute("href")).toBe("/report");
  });

  it("falls back to English for a path without a language, with links in the URL's language otherwise", () => {
    at("/xx/foo");
    render(<NotFoundContent />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(NOT_FOUND_MESSAGES.en.heading);
    expect(document.documentElement.lang).toBe("en");
    cleanup();
    at("/de/weg");
    render(<NotFoundContent />);
    const de = NOT_FOUND_MESSAGES.de;
    expect(within(screen.getByRole("banner")).getByRole("link", { name: de.signup }).getAttribute("href")).toBe("/de/register");
    expect(within(screen.getByRole("contentinfo")).getByRole("link", { name: de.report }).getAttribute("href")).toBe("/de/report");
  });

  it("draws an empty print proof, not a broken code (DESIGN.md: never a code that cannot scan)", () => {
    at("/en/x");
    render(<NotFoundContent />);
    const art = screen.getByRole("img", { name: NOT_FOUND_MESSAGES.en.art });
    expect(art.tagName.toLowerCase()).toBe("svg");
    expect(art.textContent).toContain("404");
  });

  it("has every text in every language", () => {
    const keys = Object.keys(NOT_FOUND_MESSAGES.en).sort();
    for (const messages of Object.values(NOT_FOUND_MESSAGES)) {
      expect(Object.keys(messages).sort()).toEqual(keys);
      for (const v of Object.values(messages)) expect(v.trim()).not.toBe("");
    }
  });
});
