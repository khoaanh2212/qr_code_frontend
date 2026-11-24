import { authFailure, type AuthMessages } from "@/features/auth/form-rules";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";

export type CodeField = "target_url" | "name" | "colors";

/** What to show for a failed code request: a field message or a form alert. */
export function codeFailure(err: unknown, t: Messages["codes"], auth: AuthMessages): { field?: CodeField; message: string } {
  if (!(err instanceof ApiError)) return { message: t.errors.generic };
  switch (err.code) {
    case "validation_error":
      if (err.field === "target_url") return { field: "target_url", message: t.errors.targetUrl };
      if (err.field === "name") return { field: "name", message: t.errors.generic };
      if (err.field === "fg" || err.field === "bg") return { field: "colors", message: t.errors.colors };
      return { message: t.errors.generic };
    case "email_not_verified":
      return { message: t.errors.verifyFirst };
    case "code_limit_reached":
      return { message: t.errors.limit };
    case "code_locked":
      return { message: t.errors.locked };
    default:
      return { message: authFailure(err, auth).message };
  }
}
