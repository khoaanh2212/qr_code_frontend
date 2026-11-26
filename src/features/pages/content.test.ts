import { describe, expect, it } from "vitest";
import { buildContent, editorPath, initialContent, editableTypes, newItem, type PageTypeInfo } from "./content";

const links: PageTypeInfo = {
  name: "links",
  fields: [
    { name: "title", kind: "text", required: true, max: 80 },
    { name: "description", kind: "multiline", max: 300 },
    { name: "avatar_upload_id", kind: "upload" },
    {
      name: "links",
      kind: "list",
      required: true,
      max: 20,
      items: [
        { name: "label", kind: "text", required: true, max: 60 },
        { name: "url", kind: "url", required: true },
      ],
    },
  ],
};
const business: PageTypeInfo = {
  name: "business",
  fields: [
    { name: "name", kind: "text", required: true },
    { name: "hours", kind: "list", max: 14, items: [{ name: "day", kind: "weekday", required: true }, { name: "opens", kind: "time", required: true }] },
  ],
};

describe("page content", () => {
  it("starts with empty fields and one item in a required list", () => {
    expect(initialContent(links)).toEqual({ title: "", description: "", avatar_upload_id: "", links: [{ label: "", url: "" }] });
    expect(initialContent(business)).toEqual({ name: "", hours: [] });
  });

  it("sends trimmed values and leaves out empty optional fields and empty list items", () => {
    const built = buildContent(links, {
      title: "  Café Lan ",
      description: "",
      links: [{ label: " Menu ", url: "example.com/menu" }, { label: "", url: " " }],
    });
    expect(built).toEqual({ ok: true, content: { title: "Café Lan", links: [{ label: "Menu", url: "https://example.com/menu" }] }, places: { links: [0] } });
  });

  it("names every missing required field by its API path, list items included", () => {
    const built = buildContent(links, { title: " ", links: [{ label: "Menu", url: "" }] });
    expect(built).toEqual({ ok: false, missing: ["title", "links[0].url"] });
    expect(buildContent(links, { title: "A", links: [{ label: "", url: "" }] })).toEqual({ ok: false, missing: ["links"] });
    expect(buildContent(business, { name: "Lan", hours: [{ day: "sat", opens: "8:00 " }] })).toEqual({
      ok: true,
      content: { name: "Lan", hours: [{ day: "sat", opens: "8:00" }] },
      places: { hours: [0] },
    });
  });

  it("offers every type whose lists hold no list, uploads included (menu comes later)", () => {
    const pdf: PageTypeInfo = { name: "pdf", fields: [{ name: "pdf_upload_id", kind: "upload_pdf", required: true }, { name: "title", kind: "text", required: true }] };
    const images: PageTypeInfo = {
      name: "images",
      fields: [{ name: "images", kind: "list", required: true, items: [{ name: "upload_id", kind: "upload", required: true }] }],
    };
    expect(editableTypes([links, pdf, images, business]).map((t) => t.name)).toEqual(["links", "pdf", "images", "business"]);
  });

  const menu: PageTypeInfo = {
    name: "menu",
    fields: [
      { name: "title", kind: "text", required: true },
      {
        name: "sections",
        kind: "list",
        items: [
          { name: "name", kind: "text", required: true },
          { name: "items", kind: "list", required: true, items: [{ name: "name", kind: "text", required: true }, { name: "price", kind: "text" }] },
        ],
      },
    ],
  };

  it("draws lists inside list items: a new section starts with one dish", () => {
    expect(editableTypes([menu]).map((t) => t.name)).toEqual(["menu"]);
    expect(newItem(menu.fields[1])).toEqual({ name: "", items: [{ name: "", price: "" }] });
  });

  it("builds nested lists, leaving out blank dishes and sections, with paths at every depth", () => {
    const built = buildContent(menu, {
      title: "Café",
      sections: [
        { name: "", items: [{ name: "", price: "" }] },
        { name: "Drinks", items: [{ name: "", price: "" }, { name: "Tea", price: " 40k " }] },
      ],
    });
    expect(built).toEqual({
      ok: true,
      content: { title: "Café", sections: [{ name: "Drinks", items: [{ name: "Tea", price: "40k" }] }] },
      places: { sections: [1], "sections[1].items": [1] },
    });
    expect(editorPath("sections[0].items[0].price", built.ok ? built.places : undefined)).toBe("sections[1].items[1].price");
    expect(buildContent(menu, { title: "Café", sections: [{ name: "Drinks", items: [{ name: "", price: "5" }] }] })).toEqual({
      ok: false,
      missing: ["sections[0].items[0].name"],
    });
    expect(buildContent(menu, { title: "Café", sections: [{ name: "Drinks", items: [] }] })).toEqual({
      ok: false,
      missing: ["sections[0].items"],
    });
  });

  it("takes an item whose only values are preset choices as blank", () => {
    const hours = buildContent(business, { name: "Lan", hours: [{ day: "mon", opens: "" }] });
    expect(hours).toEqual({ ok: true, content: { name: "Lan" }, places: {} });
    const social: PageTypeInfo = {
      name: "social",
      fields: [{ name: "channels", kind: "list", required: true, items: [{ name: "network", kind: "social_network", required: true }, { name: "username", kind: "text", required: true }] }],
    };
    expect(buildContent(social, { channels: [{ network: "instagram", username: "" }] })).toEqual({ ok: false, missing: ["channels"] });
    expect(buildContent(social, { channels: [{ network: "tiktok", username: "lan" }] })).toEqual({
      ok: true,
      content: { channels: [{ network: "tiktok", username: "lan" }] },
      places: { channels: [0] },
    });
  });

  it("names a missing field by the item's place in the editor, blank items before it included", () => {
    const built = buildContent(links, { title: "A", links: [{ label: "", url: "" }, { label: "Menu", url: "" }] });
    expect(built).toEqual({ ok: false, missing: ["links[1].url"] });
  });

  it("turns the API's place of a sent item back into the editor's", () => {
    const built = buildContent(links, { title: "A", links: [{ label: "", url: "" }, { label: "Menu", url: "x.example" }] });
    expect(built.ok && built.places).toEqual({ links: [1] });
    expect(editorPath("links[0].url", built.ok ? built.places : undefined)).toBe("links[1].url");
    expect(editorPath("title", undefined)).toBe("title");
  });

  it("sends an upload's id like any field, and names a missing required upload", () => {
    const pdf: PageTypeInfo = { name: "pdf", fields: [{ name: "pdf_upload_id", kind: "upload_pdf", required: true }, { name: "title", kind: "text", required: true }] };
    expect(buildContent(pdf, { pdf_upload_id: "", title: "Menu" })).toEqual({ ok: false, missing: ["pdf_upload_id"] });
    expect(buildContent(pdf, { pdf_upload_id: "u1", title: "Menu" })).toEqual({ ok: true, content: { pdf_upload_id: "u1", title: "Menu" }, places: {} });
  });
});
