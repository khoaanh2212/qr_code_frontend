/**
 * Thin fetch wrapper for the Go API. Two instances exist (see ./index.ts):
 * - `publicApi` never sends cookies; marketing pages use only this one.
 * - `sessionApi` sends the API's session cookie (`credentials: "include"`); app and auth pages.
 *
 * Errors follow the API's single shape `{ "error": { "code", "message" } }` and surface as
 * ApiError, so callers branch on `code`, never on the message text.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** The offending input of a 422 `validation_error`. */
    readonly field?: string,
    /** Seconds to wait, from `Retry-After` on 429 and 503. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  credentials: "include" | "omit";
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export class ApiClient {
  private readonly origin: string;
  private readonly credentials: "include" | "omit";
  private readonly doFetch: typeof fetch;

  constructor({ baseUrl, credentials, fetch: f }: ApiClientOptions) {
    this.origin = new URL(baseUrl).origin;
    this.credentials = credentials;
    this.doFetch = f ?? ((...args) => globalThis.fetch(...args));
  }

  /** Absolute URL of an API path; only paths on the API origin are accepted. */
  url(path: string): string {
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error(`ApiClient: path must start with a single "/": ${path}`);
    }
    return this.origin + path;
  }

  async request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const res = await this.send(path, options, "application/json");
    if (res.status === 204) return undefined as T;
    try {
      return (await res.json()) as T;
    } catch (err) {
      if (options.signal?.aborted) throw err;
      throw new ApiError(res.status, "invalid_response", "The server sent an unreadable response.");
    }
  }

  /** For file responses: rendered images by default, or what `accept` names (a CSV export). */
  async requestBlob(path: string, options: RequestOptions = {}, accept = "image/*"): Promise<Blob> {
    const res = await this.send(path, options, accept);
    return res.blob();
  }

  /** Sends the request; resolves with an OK response or rejects with ApiError. */
  private async send(path: string, { method = "GET", body, signal }: RequestOptions, accept: string): Promise<Response> {
    const url = this.url(path);
    const headers = new Headers({ Accept: accept });
    // Form data goes as it is: the browser sets the multipart type and boundary.
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !form) headers.set("Content-Type", "application/json");

    let res: Response;
    try {
      res = await this.doFetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
        credentials: this.credentials,
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new ApiError(0, "network_error", "The server could not be reached.");
    }
    if (res.ok) return res;

    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      if (signal?.aborted) throw err;
    }
    const e = (data as { error?: { code?: unknown; message?: unknown; field?: unknown } } | undefined)?.error;
    const code = typeof e?.code === "string" ? e.code : `http_${res.status}`;
    const message = typeof e?.message === "string" ? e.message : "Request failed.";
    const field = typeof e?.field === "string" ? e.field : undefined;
    const retry = Number.parseInt(res.headers.get("Retry-After") ?? "", 10);
    throw new ApiError(res.status, code, message, field, Number.isFinite(retry) && retry >= 0 ? retry : undefined);
  }

  /** For endpoints that answer 204 No Content. */
  async requestVoid(path: string, options: RequestOptions = {}): Promise<void> {
    await this.request<unknown>(path, options);
  }
}
