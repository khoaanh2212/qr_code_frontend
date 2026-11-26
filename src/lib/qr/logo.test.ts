import { describe, expect, it } from "vitest";
import { LOGO_MAX_BYTES, LogoError, readLogo } from "./logo";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);

describe("readLogo", () => {
  it("accepts PNG and JPEG by their bytes and returns base64", async () => {
    const logo = await readLogo(new File([png], "logo.png", { type: "image/png" }));
    expect(logo).toMatchObject({ name: "logo.png", base64: Buffer.from(png).toString("base64") });
    expect(logo.id).toMatch(/\S/);
    await expect(readLogo(new File([jpeg], "photo", { type: "" }))).resolves.toMatchObject({ name: "photo" });
  });

  it("accepts GIF and SVG by their content", async () => {
    await expect(readLogo(new File(["GIF89a\x01\x00"], "anim", { type: "" }))).resolves.toMatchObject({ name: "anim" });
    const svg = '\ufeff<?xml version="1.0"?>\n<!-- logo --><svg xmlns="http://www.w3.org/2000/svg"/>';
    await expect(readLogo(new File([svg], "logo.txt", { type: "text/plain" }))).resolves.toMatchObject({ name: "logo.txt" });
  });

  it("rejects other content, whatever the name or declared type says", async () => {
    const html = new File(["<html><svg/></html>"], "logo.svg", { type: "image/svg+xml" });
    await expect(readLogo(html)).rejects.toMatchObject({ reason: "type" });
    await expect(readLogo(new File(["%PDF-1.7"], "logo.png", { type: "image/png" }))).rejects.toMatchObject({ reason: "type" });
  });

  it("rejects files over 1 MB", async () => {
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(png);
    await expect(readLogo(new File([big], "big.png"))).rejects.toBeInstanceOf(LogoError);
    await expect(readLogo(new File([big], "big.png"))).rejects.toMatchObject({ reason: "size" });
  });
});
