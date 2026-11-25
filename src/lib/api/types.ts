import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";

/** Response shapes of the Go API (see its README and bruno/ collection). */

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin";
  email_verified: boolean;
  /** False for an account created through Google: it sets a password through the reset email. */
  has_password: boolean;
  created_at: string;
}

/** A linked login (Google). The provider's own user id is never sent. */
export interface Identity {
  provider: "google";
  email: string;
  created_at: string;
  last_used_at: string | null;
}

export interface Workspace {
  id: string;
  /** Empty for a personal workspace. */
  name: string;
  plan: string;
  personal: boolean;
  role: "owner" | "admin" | "editor" | "viewer";
  created_at: string;
}

export interface MeResponse {
  user: User;
  /** Sent by GET /v1/me only. */
  identities?: Identity[];
  /** Sent by GET /v1/me only; the personal workspace first. */
  workspaces?: Workspace[];
}

/** Image options of a dynamic code; unset values take the renderer's defaults. */
export interface CodeDesign {
  fg?: string;
  bg?: string;
  ecc?: "L" | "M" | "Q" | "H";
  margin?: number;
  module?: string;
  eye?: string;
  frame?: string;
  frame_text?: string;
  eye_frame?: string;
  eye_ball?: string;
  eye_color?: string;
  eye_ball_color?: string;
  frame_color?: string;
  logo_icon?: string;
}

export type CodeStatus = "active" | "paused" | "locked";

/** A named design of a workspace, applied to codes by copying it. */
export interface DesignTemplate {
  id: string;
  name: string;
  design: CodeDesign;
  created_at: string;
  updated_at: string;
}

/** A dynamic code: a short link that redirects to target_url. */
export interface DynamicCode {
  id: string;
  short_code: string;
  /** What the code's image encodes. */
  short_url: string;
  name: string;
  target_url: string;
  design: CodeDesign;
  status: CodeStatus;
  created_at: string;
  updated_at: string;
}

export interface CodeEnvelope {
  code: DynamicCode;
}

/** A code as GET /v1/workspaces/{wid}/codes lists it: with its all-time scans. */
export interface ListedCode extends DynamicCode {
  scans_total: number;
}

/** Orders of the codes list (backend PLAN item 50). */
export type CodeSort = "newest" | "oldest" | "name" | "scans";

/**
 * A page of codes. `next_cursor` continues the same query only (same `q`, `status`, `sort`);
 * null on the last page.
 */
export interface CodesPage {
  codes: ListedCode[];
  next_cursor: string | null;
}

/** POST /v1/workspaces/{wid}/codes/bulk (backend PLAN item 51): up to 100 ids. */
export type BulkAction = "pause" | "resume" | "delete";

/** What a bulk request did to one code; `code` is the changed code after a pause or resume. */
export interface BulkResult {
  id: string;
  result: "ok" | "not_found" | "locked" | "email_not_verified" | "failed";
  code?: DynamicCode;
}

export interface BulkResponse {
  results: BulkResult[];
}

export interface CountEntry {
  value: string;
  scans: number;
}

/** A code's scans over a range of UTC days, every day listed. */
export interface CodeStats {
  from: string;
  to: string;
  scans: number;
  daily: { day: string; scans: number; unique_scans: number }[];
  countries: CountEntry[];
  devices: CountEntry[];
  os: CountEntry[];
  browsers: CountEntry[];
}

/** A second login step the account has (backend model.MFAMethod), in the API's order. */
export type MfaMethod = "totp" | "passkey" | "recovery_code";

/** POST /v1/auth/login: either the session is open, or a second step is needed. */
export type LoginResponse = { user: User; mfa_required?: undefined } | { mfa_required: true; methods: MfaMethod[] };

/** GET /v1/auth/login/mfa: the login waiting for its second step. */
export interface PendingLogin {
  methods: MfaMethod[];
  expires_at: string;
}

/**
 * WebAuthn options as go-webauthn sends them ({publicKey: ...}, already in the JSON form);
 * `publicKey` goes to the browser API. Request options for a login, creation options to add one.
 */
export interface WebAuthnOptions<T = PublicKeyCredentialRequestOptionsJSON> {
  publicKey: T;
}

/** POST /v1/auth/login/mfa */
export type MfaLoginStep =
  | { method: "totp" | "recovery_code"; code: string }
  | { method: "passkey"; assertion: AuthenticationResponseJSON };

/** A passkey of the account (GET /v1/me/mfa). */
export interface AccountPasskey {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

/** GET /v1/me/mfa and every change: the account's second steps. */
export interface MfaStatus {
  enabled: boolean;
  totp: boolean;
  passkeys: AccountPasskey[];
  recovery_codes_left: number;
}

/** A change to the second steps; `recovery_codes` only when it turned two-step verification on. */
export interface MfaChange {
  mfa: MfaStatus;
  recovery_codes?: string[];
}

/** POST /v1/me/mfa/totp: a pending authenticator-app setup (shown once). */
export interface TotpSetup {
  secret: string;
  uri: string;
  expires_at: string;
}

/** POST /v1/me/mfa/passkeys/options */
export interface PasskeyCreation {
  token: string;
  passkey: WebAuthnOptions<PublicKeyCredentialCreationOptionsJSON>;
}

/** POST /v1/me/mfa/passkeys */
export interface NewPasskey {
  token: string;
  attestation: RegistrationResponseJSON;
  name: string;
}
