import { config } from "@/lib/config";
import { ApiClient } from "./client";

export { ApiClient, ApiError } from "./client";

/** No cookies: the only client marketing pages may use. */
export const publicApi = new ApiClient({ baseUrl: config.apiBaseUrl, credentials: "omit" });

/** Sends the API session cookie: app and auth pages only. */
export const sessionApi = new ApiClient({ baseUrl: config.apiBaseUrl, credentials: "include" });
