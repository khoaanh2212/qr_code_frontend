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

export interface MeResponse {
  user: User;
  /** Sent by GET /v1/me only. */
  identities?: Identity[];
}
