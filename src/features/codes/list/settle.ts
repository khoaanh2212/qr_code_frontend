/**
 * Runs `task` for every id, at most `limit` at a time, and reports which ids succeeded and which
 * failed. Never rejects for a task's failure; `onError` sees each one (e.g. to catch an expired
 * session).
 */
export async function settleEach(
  ids: readonly string[],
  task: (id: string) => Promise<void>,
  { limit = 4, onError }: { limit?: number; onError?: (err: unknown) => void } = {},
): Promise<{ ok: string[]; failed: string[] }> {
  const width = Math.max(1, Math.floor(limit));
  const ok: string[] = [];
  const failed: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++]!;
      try {
        await task(id);
        ok.push(id);
      } catch (err) {
        failed.push(id);
        try {
          onError?.(err);
        } catch {
          // A failing observer must not stop the other tasks or reject the run.
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, ids.length) }, worker));
  // Report in the input order, whatever order the tasks finished in.
  const rank = new Map(ids.map((id, i) => [id, i]));
  const order = (a: string, b: string) => rank.get(a)! - rank.get(b)!;
  return { ok: ok.sort(order), failed: failed.sort(order) };
}
