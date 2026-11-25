/** These limits mirror the backend (backend PLAN item 54); the server stays the authority. */
export const FOLDER_NAME_MAX = 60;
/** How many folders a workspace may have. */
export const MAX_FOLDERS = 100;

/** Values for the `{max}` and `{folders}` placeholders of the messages. */
export const FOLDER_LIMITS = { max: FOLDER_NAME_MAX, folders: MAX_FOLDERS } as const;

/** Only the codes that are in no folder: `folder=none` in the list, and "No folder" in a picker. */
export const NO_FOLDER = "none";
/** The picker's "nothing chosen yet" value. */
export const PICK_UNSET = "";

/** The folder id a picker value stands for: null for "no folder". */
export function folderIdOf(pick: string): string | null {
  return pick === NO_FOLDER ? null : pick;
}

/**
 * A folder name as the server stores it (NFC, whitespace runs collapsed to one space, trimmed), so
 * the length counted here is the length the server counts.
 */
export function normalizeFolderName(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim();
}
