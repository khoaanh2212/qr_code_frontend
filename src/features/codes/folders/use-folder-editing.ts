"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import type { Folder } from "@/lib/api/types";
import { folderFailure } from "./errors";
import type { UseFoldersResult } from "./use-folders";

type Editing = { kind: "create" } | { kind: "rename"; id: string };

export interface PendingFolderDelete {
  folder: Folder;
  error?: string;
}

export interface FolderEditing {
  /** The form that is open: a new folder, or the folder being renamed (gone folders close it). */
  form: { kind: "create" } | { kind: "rename"; folder: Folder } | null;
  startCreate: () => void;
  startRename: (folder: Folder) => void;
  closeForm: () => void;
  /** Saves the open form; rejects with the API's error. */
  submit: (name: string) => Promise<void>;
  pendingDelete: PendingFolderDelete | null;
  deleting: boolean;
  askDelete: (folder: Folder) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
}

interface Options {
  t: Messages["codes"];
  folders: UseFoldersResult;
  /** The folder filter is on this folder (its deletion switches the list to all codes first). */
  isSelected: (id: string) => boolean;
  onDeselect: () => void;
  /** A change worth saying ("Folder created."). */
  announce: (message: string) => void;
  /** After a folder was deleted. */
  onDeleted?: () => void;
}

/**
 * Create, rename and delete for the folders list: which form is open, the delete confirmation and
 * its errors. Focus goes back to the control that opened a form once it closes.
 */
export function useFolderEditing({ t, folders, isSelected, onDeselect, announce, onDeleted }: Options): FolderEditing {
  const f = t.folders;
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingFolderDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const deletingNow = useRef(false);

  const open = useCallback((next: Editing) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(next);
  }, []);

  // Back from a form (saved or cancelled): the control that opened it takes focus again.
  useEffect(() => {
    if (editing === null && opener.current) {
      if (opener.current.isConnected) opener.current.focus();
      opener.current = null;
    }
  }, [editing]);

  const renaming = editing?.kind === "rename" ? folders.folders.find((x) => x.id === editing.id) : undefined;
  const form: FolderEditing["form"] = editing?.kind === "create" ? editing : renaming ? { kind: "rename", folder: renaming } : null;

  const submit = useCallback(
    async (name: string) => {
      if (!editing) return;
      if (editing.kind === "create") {
        const created = await folders.create(name);
        announce(format(f.created, { name: created.name }));
      } else {
        try {
          const renamed = await folders.rename(editing.id, name);
          announce(format(f.renamed, { name: renamed.name }));
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) throw err;
          // Deleted elsewhere: close the form, look at the folders again, and say so.
          folders.reload(true);
          announce(f.notFound);
        }
      }
      setEditing(null);
    },
    [editing, folders, announce, f],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || deletingNow.current) return;
    const { folder } = pendingDelete;
    deletingNow.current = true;
    setDeleting(true);
    try {
      await folders.remove(folder.id, () => {
        if (isSelected(folder.id)) onDeselect(); // together with the folder leaving the list
      });
      setPendingDelete(null);
      announce(format(f.deleted, { name: folder.name }));
      onDeleted?.();
    } catch (err) {
      setPendingDelete({ folder, error: folderFailure(err, f).message });
    } finally {
      deletingNow.current = false;
      setDeleting(false);
    }
  }, [pendingDelete, folders, isSelected, onDeselect, announce, onDeleted, f]);

  return {
    form,
    startCreate: useCallback(() => open({ kind: "create" }), [open]),
    startRename: useCallback((folder: Folder) => open({ kind: "rename", id: folder.id }), [open]),
    closeForm: useCallback(() => setEditing(null), []),
    submit,
    pendingDelete,
    deleting,
    askDelete: useCallback((folder: Folder) => setPendingDelete({ folder }), []),
    confirmDelete: () => void confirmDelete(),
    cancelDelete: useCallback(() => {
      if (!deletingNow.current) setPendingDelete(null);
    }, []),
  };
}
