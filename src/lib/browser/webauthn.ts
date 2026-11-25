import { browserSupportsWebAuthn, startAuthentication, type AuthenticationResponseJSON } from "@simplewebauthn/browser";
import type { WebAuthnOptions } from "@/lib/api/types";

// Browser side of the passkey ceremonies. The backend's options are already in the WebAuthn JSON
// form (base64url); the results go back to it unchanged.

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn();
}

/** navigator.credentials.get for a login; resolves to the assertion JSON. */
export function getPasskeyAssertion(options: WebAuthnOptions): Promise<AuthenticationResponseJSON> {
  return startAuthentication({ optionsJSON: options.publicKey });
}

/**
 * Why a ceremony failed in the browser (it never reached the server): the person closed the dialog
 * or it timed out, or something else went wrong.
 */
export function passkeyFailureKind(err: unknown): "cancelled" | "failed" {
  const name = err instanceof Error ? err.name : "";
  return name === "NotAllowedError" || name === "AbortError" ? "cancelled" : "failed";
}
