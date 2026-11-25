"use client";

import { useRef, useState } from "react";
import { FormAlert } from "@/components/form/form-bits";
import { Select, type SelectOption } from "@/components/ui/select";
import { Section, SavedNote } from "@/features/account/section";
import { redirectToLogin } from "@/features/auth/require-session";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import { ApiError } from "@/lib/api";
import type { DynamicCode } from "@/lib/api/types";
import { updateCode } from "./api";
import { isFolderGone } from "./folders/errors";
import { folderIdOf, NO_FOLDER } from "./folders/rules";
import { useFolders } from "./folders/use-folders";

/**
 * Which folder a code is in, as a select with "No folder" first; a change saves at once. Hidden
 * from viewers, and while there are no folders to choose from (folders are made on the codes
 * list). A locked code keeps its folder: the select is disabled.
 */
export function FolderSection({
  t,
  locale,
  ws,
  code,
  canEdit,
  onSaved,
}: {
  t: Messages["codes"];
  locale: string;
  ws: string;
  code: DynamicCode;
  canEdit: boolean;
  onSaved: (c: DynamicCode) => void;
}) {
  const f = t.folders;
  const folders = useFolders(canEdit ? ws : undefined);
  const [busy, setBusy] = useState(false);
  const running = useRef(false); // read synchronously: two changes in one frame must not both send
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();

  if (!canEdit || folders.state.kind !== "ready" || (folders.folders.length === 0 && !code.folder_id)) return null;

  const options: SelectOption<string>[] = [
    { value: NO_FOLDER, label: f.none },
    ...folders.folders.map((folder) => ({ value: folder.id, label: folder.name })),
  ];
  const current = code.folder_id && folders.folders.some((x) => x.id === code.folder_id) ? code.folder_id : NO_FOLDER;

  async function change(pick: string) {
    if (running.current || pick === current) return;
    running.current = true;
    setBusy(true);
    setNote(undefined);
    setError(undefined);
    try {
      const updated = await updateCode(ws, code.id, { folder_id: folderIdOf(pick) });
      onSaved(updated);
      const name = folders.folders.find((x) => x.id === pick)?.name ?? "";
      setNote(pick === NO_FOLDER ? f.movedOut : format(f.movedOne, { folder: name }));
      folders.reload(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return redirectToLogin();
      if (isFolderGone(err)) folders.reload(true);
      setError(
        err instanceof ApiError && err.code === "code_locked"
          ? t.errors.locked
          : isFolderGone(err)
            ? plural(locale, f.moveFolderGone, 1)
            : t.errors.generic,
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <Section title={f.detailTitle} description={f.detailIntro}>
      <fieldset disabled={code.status === "locked"} aria-busy={busy || undefined} className="flex flex-col gap-3">
        <Select label={f.detailTitle} hideLabel value={current} options={options} onChange={(pick) => void change(pick)} />
        <FormAlert message={error} />
        <SavedNote message={note} />
      </fieldset>
    </Section>
  );
}
