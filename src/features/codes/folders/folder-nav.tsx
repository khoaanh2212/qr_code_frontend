"use client";

import { Folder as FolderIcon, FolderCog, FolderMinus, FolderPlus, Layers, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Select, type SelectOption } from "@/components/ui/select";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import type { Folder } from "@/lib/api/types";
import { ALL_FOLDERS, NO_FOLDER, type FolderFilter } from "../list/query";

type T = Messages["codes"];

/** What a folder list lets the person do. Absent for viewers (they only filter). */
export interface FolderActions {
  onCreate: () => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
}

export interface FolderChoiceProps {
  t: T;
  folders: readonly Folder[];
  /** "all", "none" or a folder id. */
  selected: FolderFilter;
  onSelect: (choice: FolderFilter) => void;
  /** Absent: the person may not change folders. */
  actions?: FolderActions;
}

const ROW = "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-left text-sm transition-colors duration-150";

function ChoiceButton({
  icon,
  label,
  count,
  current,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "true" : undefined}
      onClick={onClick}
      className={`${ROW} ${current ? "bg-accent-soft font-semibold" : "font-medium hover:bg-foreground/5"}`}
    >
      {icon}
      {/* A long name is cut, the whole of it stays in the tooltip. */}
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      {count !== undefined && <span className="text-xs tabular-nums text-muted">{count}</span>}
    </button>
  );
}

/**
 * The folder filter as a column (wide screens): "All codes", "No folder", then each folder with
 * its number of codes, the current one marked with `aria-current`. Editors also get a menu per
 * folder (rename, delete) and "New folder". Folder names are user content: plain text only.
 */
export function FolderNav({ t, folders, selected, onSelect, actions }: FolderChoiceProps) {
  const f = t.folders;
  const headingId = useId();
  const icon = (Icon: typeof FolderIcon) => <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />;
  return (
    <nav aria-labelledby={headingId} className="hidden min-w-0 flex-col gap-2 lg:flex">
      <h2 id={headingId} className="px-3 text-sm font-semibold text-muted">
        {f.nav}
      </h2>
      <ul className="flex flex-col gap-0.5">
        <li className="flex items-center">
          <ChoiceButton icon={icon(Layers)} label={f.all} current={selected === ALL_FOLDERS} onClick={() => onSelect(ALL_FOLDERS)} />
        </li>
        <li className="flex items-center">
          <ChoiceButton icon={icon(FolderMinus)} label={f.none} current={selected === NO_FOLDER} onClick={() => onSelect(NO_FOLDER)} />
        </li>
        {folders.map((folder) => (
          <li key={folder.id} className="flex items-center">
            <ChoiceButton
              icon={icon(FolderIcon)}
              label={folder.name}
              count={folder.code_count}
              current={selected === folder.id}
              onClick={() => onSelect(folder.id)}
            />
            {actions && (
              <Menu label={format(t.list.actions, { name: folder.name })}>
                <MenuItem icon={Pencil} onSelect={() => actions.onRename(folder)}>
                  {f.rename}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={Trash2} tone="danger" onSelect={() => actions.onDelete(folder)}>
                  {f.delete}
                </MenuItem>
              </Menu>
            )}
          </li>
        ))}
      </ul>
      {actions && (
        <button
          type="button"
          onClick={actions.onCreate}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5"
        >
          <FolderPlus aria-hidden="true" className="size-4" />
          {f.newFolder}
        </button>
      )}
    </nav>
  );
}

/**
 * The same choice as a select (narrow screens), in the toolbar. Editors get a "Folder actions"
 * menu next to it: new folder, and rename or delete the folder that is selected.
 */
export function FolderPicker({ t, folders, selected, onSelect, actions }: FolderChoiceProps) {
  const f = t.folders;
  const options: SelectOption<string>[] = [
    { value: ALL_FOLDERS, label: f.all },
    { value: NO_FOLDER, label: f.none },
    ...folders.map((folder) => ({ value: folder.id, label: `${folder.name} (${folder.code_count})` })),
  ];
  const current = folders.find((folder) => folder.id === selected);
  return (
    <div className="flex min-w-0 max-w-full items-center gap-1 lg:hidden">
      <Select
        label={f.filter}
        hideLabel
        value={options.some((o) => o.value === selected) ? selected : ALL_FOLDERS}
        options={options}
        onChange={onSelect}
        className="min-w-0"
      />
      {actions && (
        <Menu label={f.folderActions} icon={FolderCog}>
          <MenuItem icon={FolderPlus} onSelect={actions.onCreate}>
            {f.newFolder}
          </MenuItem>
          <MenuItem icon={Pencil} disabled={!current} onSelect={() => current && actions.onRename(current)}>
            {f.renameCurrent}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={Trash2} tone="danger" disabled={!current} onSelect={() => current && actions.onDelete(current)}>
            {f.deleteCurrent}
          </MenuItem>
        </Menu>
      )}
    </div>
  );
}
