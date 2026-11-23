import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./client";

function fakeFetch(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ApiClient", () => {
  it("sends JSON with the configured credentials mode", async () => {
    const f = fakeFetch(json(200, { user: { id: "1" } }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "include", fetch: f });

    const out = await client.request<{ user: { id: string } }>("/v1/me", {
      method: "PATCH",
      body: { display_name: "A" },
    });

    expect(out.user.id).toBe("1");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/me");
    expect(init?.method).toBe("PATCH");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe('{"display_name":"A"}');
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("public clients never send cookies", async () => {
    const f = fakeFetch(json(200, {}));
    await new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f }).request("/v1/qr/types");
    expect(f.mock.calls[0][1]?.credentials).toBe("omit");
  });

  it("returns undefined for 204", async () => {
    const f = fakeFetch(new Response(null, { status: 204 }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "include", fetch: f });
    await expect(client.requestVoid("/v1/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it.each([
    ["an empty body", ""],
    ["an HTML body", "<html>proxy page</html>"],
  ])("rejects a 200 with %s", async (_, body) => {
    const f = fakeFetch(new Response(body, { status: 200 }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    await expect(client.request("/v1/qr/types")).rejects.toMatchObject({ status: 200, code: "invalid_response" });
  });

  it("passes an abort during the body read through", async () => {
    const abort = new AbortController();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"partial":'));
        abort.abort();
        controller.error(new DOMException("aborted", "AbortError"));
      },
    });
    const f = fakeFetch(new Response(body, { status: 200 }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    await expect(client.request("/v1/qr/types", { signal: abort.signal })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("maps the API error shape to ApiError", async () => {
    const f = fakeFetch(json(409, { error: { code: "last_admin", message: "nope" } }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "include", fetch: f });
    const err = await client.request("/v1/me", { method: "DELETE" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: "last_admin", message: "nope" });
  });

  it("maps a non-JSON error body to a generic code", async () => {
    const f = fakeFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    await expect(client.request("/v1/qr/types")).rejects.toMatchObject({ status: 502, code: "http_502" });
  });

  it("maps a network failure to status 0", async () => {
    const f = fakeFetch(new TypeError("Failed to fetch"));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    await expect(client.request("/v1/qr/types")).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("refuses paths that would leave the API origin", async () => {
    const f = fakeFetch(json(200, {}));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "include", fetch: f });
    for (const path of ["//evil.com/v1", "https://evil.com/v1", "v1/me"]) {
      await expect(client.request(path)).rejects.toThrow(/path/);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it("carries the field of a validation error and Retry-After", async () => {
    const f = fakeFetch(json(422, { error: { code: "validation_error", message: "bad", field: "url" } }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    await expect(client.request("/v1/qr/render")).rejects.toMatchObject({ status: 422, field: "url", retryAfter: undefined });

    const limited = new Response(JSON.stringify({ error: { code: "rate_limited", message: "slow" } }), {
      status: 429,
      headers: { "Retry-After": "7" },
    });
    const g = fakeFetch(limited);
    const c2 = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: g });
    await expect(c2.request("/v1/qr/render")).rejects.toMatchObject({ code: "rate_limited", retryAfter: 7 });
  });

  it("returns images as blobs", async () => {
    const f = fakeFetch(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    const blob = await client.requestBlob("/v1/qr/render?type=url", {});
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
    expect(new Headers(f.mock.calls[0][1]?.headers).get("Accept")).toBe("image/*");
  });

  it("maps errors of image requests like JSON ones", async () => {
    const f = fakeFetch(json(503, { error: { code: "busy", message: "busy" } }));
    const client = new ApiClient({ baseUrl: "https://api.example.com", credentials: "omit", fetch: f });
    await expect(client.requestBlob("/v1/qr/render")).rejects.toMatchObject({ status: 503, code: "busy" });
  });
});
