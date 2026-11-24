import { describe, expect, it } from "vitest";
import { settleEach } from "./settle";

describe("settleEach", () => {
  it("reports successes and failures in input order, whatever order they finish in", async () => {
    const delays: Record<string, number> = { a: 15, b: 1, c: 5, d: 1 };
    const result = await settleEach(["a", "b", "c", "d"], async (id) => {
      await new Promise((r) => setTimeout(r, delays[id]));
      if (id === "c" || id === "a") throw new Error(id);
    });
    expect(result).toEqual({ ok: ["b", "d"], failed: ["a", "c"] });
  });

  it("never runs more than `limit` tasks at once, and sees every error", async () => {
    let running = 0;
    let peak = 0;
    const errors: unknown[] = [];
    await settleEach(
      Array.from({ length: 10 }, (_, i) => String(i)),
      async (id) => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 1));
        running--;
        if (id === "3") throw new Error("boom");
      },
      { limit: 3, onError: (e) => errors.push(e) },
    );
    expect(peak).toBe(3);
    expect(errors).toHaveLength(1);
  });

  it("does nothing for no ids", async () => {
    expect(await settleEach([], async () => {})).toEqual({ ok: [], failed: [] });
  });
});
