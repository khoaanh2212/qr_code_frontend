/** Response shapes of the Go API (see its README and bruno/ collection). */

export interface User {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin";
  email_verified: boolean;
  created_at: string;
}

export interface MeResponse {
  user: User;
}
