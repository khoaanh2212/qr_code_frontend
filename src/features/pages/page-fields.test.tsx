// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as uploads from "@/features/uploads/api";
import { ApiError } from "@/lib/api";
import { en } from "@/i18n/messages/en";
import { initialContent, type PageDraft, type PageTypeInfo } from "./content";
import { PageFields } from "./page-fields";

const t = en.pages;
const links: PageTypeInfo = {
  name: "links",
  fields: [
    { name: "title", kind: "text", required: true, max: 80 },
    { name: "description", kind: "multiline", max: 300 },
    { name: "avatar_upload_id", kind: "upload" },
    { name: "links", kind: "list", required: true, max: 2, items: [{ name: "label", kind: "text", required: true }, { name: "url", kind: "url", required: true }] },
  ],
};
const business: PageTypeInfo = {
  name: "business",
  fields: [{ name: "hours", kind: "list", max: 14, items: [{ name: "day", kind: "weekday", required: true }, { name: "opens", kind: "time", required: true }] }],
};
const seen: { draft: PageDraft } = { draft: {} };

function Harness({ type, errors = {} }: { type: PageTypeInfo; errors?: Record<string, string> }) {
  const [draft, setDraft] = useState(() => initialContent(type));
  return (
    <PageFields
      workspaceId="w1"
      t={t}
      generator={en.generator}
      type={type}
      value={draft}
      onChange={(update) =>
        setDraft((d) => {
          const next = update(d);
          seen.draft = next;
          return next;
        })
      }
      errors={errors}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PageFields", () => {
  it("draws a field per schema entry, required ones marked, an upload as a file picker", () => {
    render(<Harness type={links} />);
    const title = screen.getByRole("textbox", { name: /Title/ }) as HTMLInputElement;
    expect(title.required).toBe(true);
    expect(title.maxLength).toBe(80);
    expect(screen.getByRole("textbox", { name: /Description/ }).tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText(`${t.upload.choose.image}: ${t.fields.avatar_upload_id}`)).toBeTruthy();
    expect(screen.getByText(t.fields.avatar_upload_id)).toBeTruthy();
    fireEvent.change(title, { target: { value: "Café Lan" } });
    expect(seen.draft.title).toBe("Café Lan");
  });

  it("adds and removes list items up to the list's maximum", () => {
    render(<Harness type={links} />);
    const list = screen.getByRole("group", { name: t.fields.links });
    expect(within(list).getAllByRole("group")).toHaveLength(1);
    fireEvent.change(within(list).getByRole("textbox", { name: /Label/ }), { target: { value: "Menu" } });
    fireEvent.click(within(list).getByRole("button", { name: `${t.add}: ${t.fields.links}` }));
    expect(within(list).getAllByRole("group")).toHaveLength(2);
    expect((within(list).getByRole("button", { name: `${t.add}: ${t.fields.links}` }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(list).getByRole("button", { name: `${t.remove}: ${t.fields.links} 1` }));
    expect(seen.draft.links).toEqual([{ label: "", url: "" }]);
  });

  it("offers weekdays by name and keeps times as typed", () => {
    render(<Harness type={business} />);
    fireEvent.click(screen.getByRole("button", { name: `${t.add}: ${t.fields.hours}` }));
    fireEvent.change(screen.getByRole("combobox", { name: t.fields.day }), { target: { value: "sat" } });
    fireEvent.change(screen.getByLabelText(new RegExp(t.fields.opens)), { target: { value: "08:30" } });
    expect(seen.draft.hours).toEqual([{ day: "sat", opens: "08:30" }]);
    expect(screen.getByRole("option", { name: t.weekdays.sun })).toBeTruthy();
  });

  it("shows a refusal at its field, list items included", () => {
    render(<Harness type={links} errors={{ "links[0].url": "Not a link" }} />);
    const url = screen.getByRole("textbox", { name: /Link \(URL\)/ });
    expect(url.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Not a link")).toBeTruthy();
  });

  it("moves focus to the new item, and after a removal to the item that took its place", () => {
    render(<Harness type={links} />);
    const list = screen.getByRole("group", { name: t.fields.links });
    fireEvent.click(within(list).getByRole("button", { name: `${t.add}: ${t.fields.links}` }));
    const labels = within(list).getAllByRole("textbox", { name: /Label/ });
    expect(document.activeElement).toBe(labels[1]);
    fireEvent.change(labels[1], { target: { value: "Second" } });
    fireEvent.click(within(list).getByRole("button", { name: `${t.remove}: ${t.fields.links} 1` }));
    const left = within(list).getByRole("textbox", { name: /Label/ }) as HTMLInputElement;
    expect(left.value).toBe("Second");
    expect(document.activeElement).toBe(left);
    fireEvent.click(within(list).getByRole("button", { name: `${t.remove}: ${t.fields.links} 1` }));
    expect(document.activeElement).toBe(within(list).getByRole("button", { name: `${t.add}: ${t.fields.links}` }));
  });

  it("names every control by its path, a list included, so a message can lead to it", () => {
    const { container } = render(<Harness type={business} />);
    expect(container.querySelector('[data-path="hours"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `${t.add}: ${t.fields.hours}` }));
    expect(container.querySelector('[data-path="hours[0].day"]')?.tagName).toBe("SELECT");
    expect(container.querySelector('[data-path="hours[0].opens"]')?.tagName).toBe("INPUT");
  });

  it("keeps a time zone the browser does not list among the choices", () => {
    const event: PageTypeInfo = { name: "event", fields: [{ name: "timezone", kind: "timezone", required: true }] };
    function Zone() {
      const [draft, setDraft] = useState<PageDraft>({ timezone: "UTC" });
      return <PageFields workspaceId="w1" t={t} generator={en.generator} type={event} value={draft} onChange={setDraft} />;
    }
    render(<Zone />);
    expect((screen.getByRole("combobox", { name: t.fields.timezone }) as HTMLSelectElement).value).toBe("UTC");
  });

  const pdfType: PageTypeInfo = { name: "pdf", fields: [{ name: "pdf_upload_id", kind: "upload_pdf", required: true }] };
  /** The file input, named by what its button shows and the field it fills. */
  const fileInput = () => screen.getByLabelText(new RegExp(`: ${t.fields.pdf_upload_id}$`), { selector: "input" }) as HTMLInputElement;
  const pick = (_: string, file: File) => act(async () => void fireEvent.change(fileInput(), { target: { files: [file] } }));

  it("uploads a chosen file to the workspace and keeps its id, shown by kind and size", async () => {
    const up = vi.spyOn(uploads, "uploadFile").mockResolvedValue({
      id: "u9", kind: "pdf", content_type: "application/pdf", size_bytes: 2_400_000, url: "", created_at: "",
    });
    render(<Harness type={pdfType} />);
    const input = fileInput();
    expect(input.accept).toBe("application/pdf");
    expect(input.getAttribute("aria-label")).toBe(`${t.upload.choose.pdf}: ${t.fields.pdf_upload_id}`);
    const file = new File(["%PDF-1.7"], "menu.pdf", { type: "application/pdf" });
    await pick(t.upload.choose.pdf, file);
    expect(up).toHaveBeenCalledWith("w1", file);
    await waitFor(() => expect(seen.draft.pdf_upload_id).toBe("u9"));
    expect(screen.getByText("PDF · 2.4 MB")).toBeTruthy();
    // The name follows what the button now says; focus stayed on the picker throughout.
    expect(fileInput().getAttribute("aria-label")).toBe(`${t.upload.replace}: ${t.fields.pdf_upload_id}`);
    expect(fileInput().disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: `${t.upload.remove}: ${t.fields.pdf_upload_id}` }));
    expect(seen.draft.pdf_upload_id).toBe("");
  });

  it("refuses a file over the kind's limit before sending it, and says the API's refusals", async () => {
    const up = vi.spyOn(uploads, "uploadFile").mockRejectedValue(new ApiError(507, "storage_quota_exceeded", "full"));
    render(<Harness type={pdfType} />);
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 });
    await pick(t.upload.choose.pdf, big);
    expect(up).not.toHaveBeenCalled();
    expect(screen.getByText(t.upload.errors.size.pdf)).toBeTruthy();
    await pick(t.upload.choose.pdf, new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByText(t.upload.errors.quota)).toBeTruthy());
    expect(seen.draft.pdf_upload_id).toBe("");
  });

  it("drops an upload that finishes after its file was removed", async () => {
    let finish: (u: Awaited<ReturnType<typeof uploads.uploadFile>>) => void = () => undefined;
    vi.spyOn(uploads, "uploadFile").mockImplementation(() => new Promise((r) => (finish = r)));
    const { unmount } = render(<Harness type={pdfType} />);
    await pick("", new File(["%PDF"], "a.pdf", { type: "application/pdf" }));
    unmount();
    await act(async () => finish({ id: "late", kind: "pdf", content_type: "application/pdf", size_bytes: 1, url: "", created_at: "" }));
    expect(seen.draft.pdf_upload_id).toBe("");
  });
});
