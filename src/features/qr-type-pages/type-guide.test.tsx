// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { TypeGuide } from "./type-guide";

afterEach(cleanup);

describe("TypeGuide", () => {
  it("renders the type's steps, details and all four questions as server text", () => {
    const page = en.typePages.pages.wifi;
    render(<TypeGuide t={en.typePages} type="wifi" />);
    expect(screen.getByRole("heading", { name: page.howToTitle })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: page.detailTitle })).toBeTruthy();
    expect(screen.getByText(page.detail1)).toBeTruthy();
    expect(screen.getByText(page.detail2)).toBeTruthy();
    for (const q of [page.q1, page.q2, page.q3, page.q4]) expect(screen.getByText(q)).toBeTruthy();
    // Answers are in the HTML even while collapsed, so crawlers read them.
    expect(screen.getByText(page.a4)).toBeTruthy();
  });
});
