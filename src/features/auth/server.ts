import { headers } from "next/headers";
import { config } from "@/lib/config";
import type { CaptchaConfig } from "./captcha";

/** Token a local API (no Turnstile secret) accepts; production builds always have a site key. */
const DEV_CAPTCHA_TOKEN = "dev-token";

/** Turnstile settings for a private page: site key and this request's CSP nonce. */
export async function getCaptchaConfig(): Promise<CaptchaConfig> {
  const nonce = (await headers()).get("x-nonce");
  const siteKey = config.turnstileSiteKey;
  return { siteKey, nonce, devToken: siteKey ? null : DEV_CAPTCHA_TOKEN };
}
