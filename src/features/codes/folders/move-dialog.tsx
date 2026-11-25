"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, type SelectOption } from "@/components/ui/select";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import type { DynamicCode, Folder } from "@/lib/api/types";
import { folderIdOf, NO_FOLDER, PICK_UNSET } from "./rules";

type T = Messages["codes"];

/** The codes being moved: one from its menu, or the selection (`bulk`). */
export interface PendingMove {
  codes: readonly DynamicCode[];
  bulk: boolean;
}

/** Where the person chose to move them: a folder id (and name) or no folder. */
export interface MoveTarget {
  id: string | null;
  name: string;
}

/** The choice a picker starts on: the code's own folder, or nothing yet for a selection. */
function initialPick(pending: PendingMove | null, folders: readonly Folder[]): string {
  if (!pending || pending.bulk) return PICK_UNSET;
  const current = pending.codes[0]?.folder_id;
  return current && folders.some((f) => f.id === current) ? current : NO_FOLDER;
}

/**
 * "Move to folder": a modal with a native select of "No folder" and each folder, then Move. It is
 * the existing ConfirmDialog (focus trap, Escape, Cancel first) with the primary tone. A single
 * code starts on its current folder (choosing it again changes nothing); a selection starts
 * on "Choose a folder…" and asks before moving without a choice.
 */
export function MoveDialog({
  t,
  pending,
  folders,
  locale,
  onConfirm,
  onCancel,
}: {
  t: T;
  pending: PendingMove | null;
  folders: readonly Folder[];
  locale: string;
  onConfirm: (codes: readonly DynamicCode[], target: MoveTarget, bulk: boolean) => void;
  onCancel: () => void;
}) {
  const f = t.folders;
  const [pick, setPick] = useState(() => initialPick(pending, folders));
  const [error, setError] = useState<string>();
  // A new request starts from its own choice, with no message left over.
  const [seen, setSeen] = useState(pending);
  if (seen !== pending) {
    setSeen(pending);
    setPick(initialPick(pending, folders));
    setError(undefined);
  }

  const options: SelectOption<string>[] = [
    ...(pending?.bulk ? [{ value: PICK_UNSET, label: f.choose }] : []),
    { value: NO_FOLDER, label: f.none },
    ...folders.map((folder) => ({ value: folder.id, label: folder.name })),
  ];
  // What is shown is what is sent: a folder picked and then deleted (a silent reload) falls back.
  const shown = options.some((o) => o.value === pick) ? pick : initialPick(pending, folders);
  const title = !pending
    ? ""
    : pending.codes.length === 1
      ? format(f.moveOneTitle, { name: pending.codes[0]!.name || t.untitled })
      : plural(locale, f.moveManyTitle, pending.codes.length);

  return (
    <ConfirmDialog
      open={pending !== null}
      title={title}
      confirmLabel={f.moveConfirm}
      cancelLabel={t.cancel}
      tone="primary"
      error={error}
      onConfirm={() => {
        if (!pending) return;
        if (shown === PICK_UNSET) return setError(f.chooseFirst);
        onConfirm(pending.codes, { id: folderIdOf(shown), name: folders.find((x) => x.id === shown)?.name ?? "" }, pending.bulk);
      }}
      onCancel={onCancel}
    >
      <div className="flex flex-col gap-3">
        <p>{f.moveBody}</p>
        <Select
          label={f.moveTo}
          value={shown}
          options={options}
          // The label sits above the select, like the app's other fields.
          className="flex-col! items-stretch! gap-1.5!"
          onChange={(value) => {
            setPick(value);
            setError(undefined);
          }}
        />
      </div>
    </ConfirmDialog>
  );
}
