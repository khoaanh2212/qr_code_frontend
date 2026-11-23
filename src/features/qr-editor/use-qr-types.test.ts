import { describe, expect, it } from "vitest";
import { sanitizeCatalog } from "./use-qr-types";

describe("sanitizeCatalog", () => {
  it("drops malformed type and field names", () => {
    const out = sanitizeCatalog({
      formats: ["png"],
      types: [
        { type: "url", fields: [{ name: "url", required: true }, { name: "__proto__", required: false }] },
        { type: "../evil", fields: [] },
        { type: "Bad Type", fields: [] },
      ],
    });
    expect(out.types.map((t) => t.type)).toEqual(["url"]);
    expect(out.types[0].fields.map((f) => f.name)).toEqual(["url"]);
  });
});
