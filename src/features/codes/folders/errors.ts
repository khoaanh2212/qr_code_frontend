import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { commonErrorMessage, toApiError } from "@/lib/api/common-errors";
import { FOLDER_LIMITS } from "./rules";

export type FolderField = "name";

/** What to show for a failed folder request: a message for the name field, or for the form. */
export function folderFailure(err: unknown, t: Messages["codes"]["folders"]): { field?: FolderField; message: string } {
  const e = toApiError(err);
  const common = commonErrorMessage(e, t.errors);
  if (common !== undefined) return { message: common };
  switch (e.code) {
    case "folder_name_taken":
      return { field: "name", message: t.errors.nameTaken };
    case "folder_limit_reached":
      return { message: format(t.errors.limit, FOLDER_LIMITS) };
    case "validation_error":
      if (e.field === "name") return { field: "name", message: format(t.errors.nameInvalid, FOLDER_LIMITS) };
      return { message: t.errors.generic };
    default:
      return { message: t.errors.generic };
  }
}

/** The moved-code failures that are about the folder rather than the code. */
export const isFolderGone = (err: unknown) => err instanceof ApiError && err.status === 422 && err.field === "folder_id";
