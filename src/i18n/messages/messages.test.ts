import { describe, expect, it } from "vitest";
import { LOCALES } from "../config";
import { loadMessages } from "./index";

function leaves(obj: object, prefix = ""): [string, unknown][] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === "object" ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]],
  );
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("messages", async () => {
  const en = new Map(leaves(await loadMessages("en")));

  it.each(LOCALES.filter((l) => l !== "en"))("%s has every English key, same placeholders, empty only where English is", async (locale) => {
    const other = new Map(leaves(await loadMessages(locale)));
    expect([...other.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [key, value] of other) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim() === "", key).toBe((en.get(key) as string).trim() === "");
      expect(placeholders(value as string), key).toEqual(placeholders(en.get(key) as string));
    }
  });
});
