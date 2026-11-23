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

  it("rejects other content, whatever the name or declared type says", async () => {
    const svg = new File(["<svg/>"], "logo.png", { type: "image/png" });
    await expect(readLogo(svg)).rejects.toMatchObject({ reason: "type" });
  });

  it("rejects files over 1 MB", async () => {
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set(png);
    await expect(readLogo(new File([big], "big.png"))).rejects.toBeInstanceOf(LogoError);
    await expect(readLogo(new File([big], "big.png"))).rejects.toMatchObject({ reason: "size" });
  });
});
