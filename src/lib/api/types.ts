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

export interface CodesPage {
  codes: DynamicCode[];
  next_cursor: string | null;
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
