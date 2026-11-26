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
  /** "#rrggbb", or "transparent" (nothing painted; colors are checked against white). */
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
  /** "linear" or "radial": the modules run from `fg` to `fg2`, or through `gradient_stops`. */
  gradient?: string;
  fg2?: string;
  /** Linear only, 0-359; absent means 0. */
  gradient_angle?: number;
  /** Two to five colors with offsets in percent; replaces `fg`/`fg2` in the gradient. */
  gradient_stops?: { offset: number; color: string }[];
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
  /** The folder the code is in (backend PLAN item 54); null when it is in none. */
  folder_id: string | null;
  /** Campaign details (backend PLAN item 55); always present, every field null when not set. */
  campaign: Campaign;
  created_at: string;
  updated_at: string;
}

/** Where a code is shown: print media, digital media, or "other" with the customer's own label. */
export type CampaignMedium =
  | "poster"
  | "flyer"
  | "brochure"
  | "business_card"
  | "packaging"
  | "product_label"
  | "magazine"
  | "newspaper"
  | "billboard"
  | "signage"
  | "menu"
  | "sticker"
  | "website"
  | "email"
  | "social_media"
  | "presentation"
  | "video"
  | "other";

/**
 * Notes on when and where a code is used; they never change where it leads. Dates are calendar
 * days (`YYYY-MM-DD`, no time zone). `medium_other` is set exactly when `medium` is "other".
 */
export interface Campaign {
  start_date: string | null;
  end_date: string | null;
  print_run: number | null;
  medium: CampaignMedium | null;
  medium_other: string | null;
}

/** A folder that groups a workspace's codes; `code_count` is the number of live codes in it. */
export interface Folder {
  id: string;
  name: string;
  code_count: number;
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
 * A page of codes. `next_cursor` continues the same query only (same `q`, `status`, `folder`, `sort`);
 * null on the last page.
 */
export interface CodesPage {
  codes: ListedCode[];
  next_cursor: string | null;
}

/** POST /v1/workspaces/{wid}/codes/bulk (backend PLAN items 51, 54): up to 100 ids; `move` also takes `folder_id`. */
export type BulkAction = "pause" | "resume" | "delete" | "move";

/** What a bulk request did to one code; `code` is the changed code after a pause, resume or move. */
export interface BulkResult {
  id: string;
  result: "ok" | "not_found" | "locked" | "email_not_verified" | "failed" | "folder_not_found";
  code?: DynamicCode;
}

export interface BulkResponse {
  results: BulkResult[];
}

export interface CountEntry {
  value: string;
  scans: number;
}

/** How the series of a stats answer is grouped (backend PLAN, item 56). */
export type StatsBucket = "day" | "week" | "month";

/** One table of a statistics export (GET .../stats/export?dataset=). */
export type StatsDataset = "series" | "countries" | "cities" | "devices" | "os" | "browsers";

/** A city scans came from; `country` is ISO 3166 alpha-2, "" when unknown (names repeat across countries). */
export interface CityEntry {
  value: string;
  country: string;
  scans: number;
}

/**
 * A code's scans over a range of UTC days. `daily` lists every day whatever the bucket; `series`
 * lists every bucket asked for (weeks from Monday, calendar months, cut to the range).
 */
export interface CodeStats {
  from: string;
  to: string;
  scans: number;
  bucket: StatsBucket;
  /** What `unique_scans` of a point of `series` counts: weeks and months add up the days. */
  unique_scans_kind: "distinct_per_day" | "sum_of_daily";
  series: { from: string; to: string; scans: number; unique_scans: number }[];
  daily: { day: string; scans: number; unique_scans: number }[];
  countries: CountEntry[];
  /** The most scanned cities; empty unless the edge reports cities (backend SCAN_CITY_HEADER). */
  cities: CityEntry[];
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
