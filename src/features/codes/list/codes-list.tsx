"use client";

import { CircleCheck, CircleX, FolderOpen, Info, Plus, QrCode, SearchX, Shapes } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ButtonLink, FormAlert } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalWorkspace } from "@/features/auth/require-session";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import type { DynamicCode, ListedCode } from "@/lib/api/types";
import { FolderForm } from "../folders/folder-form";
import { FolderNav, type FolderActions } from "../folders/folder-nav";
import { MoveDialog, type PendingMove } from "../folders/move-dialog";
import { useFolderEditing } from "../folders/use-folder-editing";
import { useFolders } from "../folders/use-folders";
import { CodeCard } from "./code-card";
import { CodesToolbar, SelectionBar, statusOptions } from "./codes-toolbar";
import { ReadyDialog } from "./ready-dialog";
import { SlugDialog } from "../slug-dialog";
import type { AuthMessages } from "@/features/auth/form-rules";
import { ALL_FOLDERS, DEFAULT_QUERY, isDefaultQuery, listParams, NO_FOLDER, type CodeQuery } from "./query";
import { useCodeActions } from "./use-code-actions";
import { useCodes } from "./use-codes";
import { useCodesView, type CodesView } from "./use-codes-view";
import { useDebouncedValue } from "./use-debounced-value";
import { useSelection } from "./use-selection";

type T = Messages["codes"];

const NO_CODES: readonly ListedCode[] = [];

/** Search waits until typing pauses: one request per settled text, not per keystroke. */
const SEARCH_DELAY_MS = 300;

/**
 * The dashboard: the personal workspace's dynamic codes, with search, status and folder filters,
 * order, list/grid layout, per-code actions and bulk pause, resume, move and delete.
 *
 * Composition only. The API searches, filters and orders (`useCodes` with `listParams`, backend
 * PLAN items 50 and 54); selection (`useSelection`), actions (`useCodeActions`, bulk through the
 * API's bulk endpoint), folders (`useFolders`, `useFolderEditing`) and the layout preference
 * (`useCodesView`) are separate hooks; `CodesToolbar`, `SelectionBar`, `FolderNav` and `CodeCard`
 * render props. The folder choice lives in the query state like status and order (it is not
 * remembered across page loads).
 *
 * Layout: from the `lg` breakpoint the folders are a column pinned to the left edge that scrolls on
 * its own, and the codes a centered column in the rest of the width. Below it the column becomes
 * a panel ("Filters" in the toolbar) that also carries the status filter, which the toolbar drops
 * on phones; phones always get the list layout, whatever was chosen on a wider screen.
 */
export function CodesList({ t, auth, templatesLabel, locale }: { t: T; auth: AuthMessages; templatesLabel: string; locale: Locale }) {
  const l = t.list;
  const f = t.folders;
  const workspace = usePersonalWorkspace();
  const ws = workspace?.id;
  const folders = useFolders(ws);
  const [query, setQuery] = useState<CodeQuery>(DEFAULT_QUERY);
  // The selected folder turned out to be gone (the list falls back to all codes).
  const [folderGone, setFolderGone] = useState(false);
  // A folder that the refreshed folder list no longer has (deleted in another tab) counts as gone
  // too: back to all codes. Adjusting state while rendering, as `useSelection` does.
  const missing =
    folders.state.kind === "ready" &&
    query.folder !== ALL_FOLDERS &&
    query.folder !== NO_FOLDER &&
    !folders.folders.some((x) => x.id === query.folder);
  if (missing) {
    setQuery({ ...query, folder: ALL_FOLDERS });
    setFolderGone(true);
  }
  const typed = useDebouncedValue(query.search, SEARCH_DELAY_MS);
  // A cleared search applies at once (no request for the old text with the new filters).
  const search = query.search.trim() === "" ? "" : typed;
  // The query the list answers: status and order at once, search once typing pauses.
  const applied = useMemo<CodeQuery>(() => ({ ...query, search }), [query, search]);
  const reloadFolders = folders.reload;
  const refreshFolders = useCallback(() => reloadFolders(true), [reloadFolders]);
  const { state, retry, loadMore, update, remove } = useCodes(ws, listParams(applied), { onEmptyFolder: refreshFolders });
  const [chosenView, setView] = useCodesView();
  // Phones get the list: the grid's small cards have no room for a card's shortcuts.
  const view: CodesView = usePhone() ? "list" : chosenView;
  const [panelOpen, setPanelOpen] = useState(false);
  // A code that was just created is greeted with its download dialog (`?ready={id}`, set by the
  // create flow). Read through the router: on a client-side navigation `window.location` still
  // holds the previous address while this renders. The parameter then leaves the address, so a
  // reload or a shared link does not greet again; the id is kept here until the dialog closes.
  const arrived = readyParam(useSearchParams()?.get("ready"));
  const [readyId, setReadyId] = useState<string | null>(arrived);
  // Another code arriving while the list stays mounted: adjusting state while rendering.
  const [seen, setSeen] = useState(arrived);
  if (arrived && arrived !== seen) {
    setSeen(arrived);
    setReadyId(arrived);
  }
  useEffect(() => {
    if (!arrived) return;
    // Only `ready` goes: the router's own state on this entry, other parameters and the hash stay.
    const rest = new URLSearchParams(window.location.search ?? "");
    rest.delete("ready");
    const query = rest.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash ?? ""}`);
  }, [arrived]);
  // The panel belongs to narrow screens: a window that grows past `lg` (a rotated tablet) has the
  // folder column instead, and must not keep a modal over it.
  useEffect(() => {
    if (!panelOpen || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia(WIDE);
    const close = () => wide.matches && setPanelOpen(false);
    close();
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, [panelOpen]);

  const codes = state.kind === "ready" ? state.codes : NO_CODES;
  const next = state.kind === "ready" ? state.next : null;
  const shown = codes; // the API's answer, in its order
  const shownIds = useMemo(() => shown.map((c) => c.id), [shown]);
  const selection = useSelection(shownIds);
  const selected = shown.filter((c) => selection.ids.has(c.id));
  const actions = useCodeActions({ workspaceId: ws, locale, t, update, remove, select: selection.set, onCodesChanged: refreshFolders });
  const { announce, move } = actions;

  // Folders: viewers only filter; editors manage them and move codes (only when there is a folder
  // to move into).
  const canEdit = workspace?.role !== "viewer";
  const canMove = canEdit && folders.folders.length > 0;
  const changeQuery = useCallback((next: CodeQuery) => {
    setFolderGone(false); // the note was about the previous choice
    setQuery(next);
  }, []);
  const chooseFolder = useCallback(
    (choice: string) => {
      setPanelOpen(false); // the list is the answer to the choice
      changeQuery({ ...query, folder: choice });
    },
    [changeQuery, query],
  );
  const editing = useFolderEditing({
    t,
    folders,
    isSelected: (id) => query.folder === id,
    onDeselect: () => setQuery((q) => ({ ...q, folder: ALL_FOLDERS })),
    announce,
    // The codes of a deleted folder are in no folder now: that view is out of date.
    onDeleted: () => {
      setFolderDeletions((n) => n + 1);
      if (query.folder === NO_FOLDER) retry();
    },
  });
  // From the panel these open a form or a dialog in the page: the panel makes way for it.
  const leavingPanel =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A) => {
      setPanelOpen(false);
      action(...args);
    };
  const folderActions: FolderActions | undefined = canEdit
    ? { onCreate: leavingPanel(editing.startCreate), onRename: leavingPanel(editing.startRename), onDelete: leavingPanel(editing.askDelete) }
    : undefined;
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [editingLink, setEditingLink] = useState<DynamicCode | null>(null);
  const folderNames = useMemo(() => new Map(folders.folders.map((x) => [x.id, x.name])), [folders.folders]);

  // After a delete the cards (and the button that opened the dialog) are gone: continue from
  // the list's heading rather than from the top of the page.
  const heading = useRef<HTMLHeadingElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (actions.deletions > 0) heading.current?.focus();
  }, [actions.deletions]);
  // The menu button that opened a deleted folder's dialog is gone too.
  const [folderDeletions, setFolderDeletions] = useState(0);
  useEffect(() => {
    if (folderDeletions > 0) heading.current?.focus();
  }, [folderDeletions]);

  const { setStatus, askDelete } = actions;
  const toggleStatus = useCallback((c: DynamicCode) => setStatus([c], c.status === "paused" ? "active" : "paused", false), [setStatus]);
  const deleteOne = useCallback((c: DynamicCode) => askDelete([c], false), [askDelete]);
  const moveOne = useCallback((c: DynamicCode) => setPendingMove({ codes: [c], bulk: false }), [setPendingMove]);
  const editLink = useCallback((c: DynamicCode) => setEditingLink(c), [setEditingLink]);

  const newHref = localizePath(locale, "/app/codes/new");
  const filtered = !isDefaultQuery(applied);
  const refreshing = state.kind === "ready" && state.refreshing;
  const refreshFailed = state.kind === "ready" && state.refreshFailed;
  // Codes about to be replaced take no action (it would be undone by the new page).
  const stale = refreshing || refreshFailed;
  // The workspace has codes while any are listed or more pages remain (deleting a whole page
  // fetches the next); under a filter the toolbar stays, so the filter can be changed back.
  const hasCodes = state.kind === "ready" && (codes.length > 0 || next !== null || filtered || stale);
  // The API sends no total: "50+" while more pages remain. Until new results arrive, say so.
  const summary = refreshing
    ? l.loading
    : plural(locale, filtered ? (next ? l.matchesMore : l.matches) : next ? l.countMore : l.count, codes.length);
  const noResults = state.kind === "ready" && shown.length === 0 && next === null && !stale;
  // Only a folder narrows the list: say the folder is empty rather than "no codes match".
  const emptyFolder = applied.folder !== ALL_FOLDERS && applied.search.trim() === "" && applied.status === "all";
  const noResultsTitle = !emptyFolder ? l.noResults : applied.folder === NO_FOLDER ? f.emptyNoFolder : f.emptyFolder;
  // Search results are announced: typing in the box gives no other cue to screen readers.
  const announcement =
    (state.kind === "loading" && workspace) || refreshing ? l.loading : filtered && !refreshFailed ? (noResults ? noResultsTitle : summary) : "";
  const activeSelected = selected.filter((c) => c.status === "active");
  const pausedSelected = selected.filter((c) => c.status === "paused");
  const folderLoadFailed = folders.state.kind === "error";

  // The folder column is there from the first paint of a workspace (so the list does not jump when
  // its codes arrive) and goes only when the workspace turns out to have no codes.
  const withColumn = Boolean(ws) && (state.kind === "loading" || hasCodes);
  const selecting = selection.state !== "none";
  const folderNav = (className?: string) => (
    <FolderNav t={t} folders={folders.folders} selected={query.folder} onSelect={chooseFolder} actions={folderActions} className={className} />
  );
  return (
    <div className={`flex w-full flex-1 ${withColumn ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]" : ""}`}>
      {/* The codes come first in the document (the page's h1 before the column's heading); the grid puts the column on the left. */}
      <div
        className={`mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-6 px-4 py-6 lg:col-start-2 lg:row-start-1 lg:px-8 ${
          selecting ? "max-lg:pb-[45dvh]" : ""
        }`}
      >
        <header className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold text-balance">{t.title}</h1>
            <p className="max-w-prose text-sm text-pretty text-muted max-sm:hidden">{t.intro}</p>
          </div>
          {/* On phones both shrink to their icon (the name stays for screen readers and as a tooltip). */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href={localizePath(locale, "/app/templates")}
              title={templatesLabel}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-control bg-surface text-sm font-medium hover:bg-foreground/5 max-sm:w-11 sm:px-3"
            >
              <Shapes aria-hidden="true" className="size-4" />
              <span className="max-sm:sr-only">{templatesLabel}</span>
            </Link>
            {hasCodes && (
              <Link
                href={newHref}
                title={t.newCode}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 max-sm:w-11 max-sm:rounded-full sm:px-4"
              >
                <Plus aria-hidden="true" className="size-4 max-sm:size-5" />
                <span className="max-sm:sr-only">{t.newCode}</span>
              </Link>
            )}
          </div>
        </header>

        {/* Live regions stay mounted, so screen readers hear each change of their text. */}
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <div role="status" className="flex flex-col gap-1 text-sm font-medium empty:hidden">
          {actions.notice.done && (
            <p className="flex items-center gap-2">
              <CircleCheck aria-hidden="true" className="size-4 text-accent" />
              {actions.notice.done}
            </p>
          )}
          {folderGone && (
            <p className="flex items-center gap-2">
              <Info aria-hidden="true" className="size-4 shrink-0 text-muted" />
              {f.gone}
            </p>
          )}
          {actions.notice.problems?.map((problem) => (
            <p key={problem} className="flex items-center gap-2 text-danger">
              <CircleX aria-hidden="true" className="size-4 shrink-0" />
              {problem}
            </p>
          ))}
        </div>

        {/* Every account has a personal workspace; without one there is nothing to load. */}
        {workspace && state.kind === "loading" && <LoadingList t={t} view={view} />}
        {(!workspace || state.kind === "error") && (
          <div className="flex flex-col items-start gap-2">
            <FormAlert message={t.loadFailed} />
            <Button variant="secondary" onClick={retry}>
              {t.retry}
            </Button>
          </div>
        )}
        {state.kind === "ready" && !hasCodes && (
          <EmptyState icon={QrCode} title={t.empty} action={<ButtonLink href={newHref}>{t.newCode}</ButtonLink>}>
            {t.emptyIntro}
          </EmptyState>
        )}

        {hasCodes && ws && (
          <section aria-labelledby="codes-heading" className="flex min-w-0 flex-col gap-3">
            <h2 ref={heading} id="codes-heading" tabIndex={-1} className="sr-only">
              {t.title}
            </h2>
            <CodesToolbar
              t={t}
              query={query}
              onQueryChange={changeQuery}
              view={view}
              onViewChange={setView}
              searchRef={searchBox}
              onOpenFilters={() => setPanelOpen(true)}
              activeFilters={(query.folder === ALL_FOLDERS ? 0 : 1) + (query.status === "all" ? 0 : 1)}
            />
            {folderLoadFailed && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <FormAlert message={f.loadFailed} />
                <Button variant="secondary" onClick={() => folders.reload()}>
                  {f.reload}
                </Button>
              </div>
            )}
            {editing.form && (
              <FolderForm
                key={editing.form.kind === "rename" ? editing.form.folder.id : "new"}
                t={t}
                label={editing.form.kind === "rename" ? f.rename : f.newFolder}
                submitLabel={editing.form.kind === "rename" ? f.save : f.create}
                initialName={editing.form.kind === "rename" ? editing.form.folder.name : ""}
                onSubmit={editing.submit}
                onClose={editing.closeForm}
              />
            )}
            {refreshFailed && (
              <div className="flex flex-col items-start gap-2">
                <FormAlert message={t.loadFailed} />
                <Button variant="secondary" onClick={retry}>
                  {t.retry}
                </Button>
              </div>
            )}
            <SelectionBar
              t={t}
              state={selection.state}
              count={selection.ids.size}
              summary={summary}
              onToggleAll={selection.toggleAll}
              onClear={selection.clear}
              onPause={activeSelected.length > 0 ? () => setStatus(activeSelected, "paused", true) : undefined}
              onResume={pausedSelected.length > 0 ? () => setStatus(pausedSelected, "active", true) : undefined}
              onMove={canMove ? () => setPendingMove({ codes: selected, bulk: true }) : undefined}
              onDelete={() => askDelete(selected, true)}
              busy={actions.busy || stale}
            />

            {noResults ? (
              <EmptyState
                icon={emptyFolder ? FolderOpen : SearchX}
                title={noResultsTitle}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (emptyFolder) return chooseFolder(ALL_FOLDERS);
                      changeQuery({ ...DEFAULT_QUERY, sort: query.sort });
                      // The button goes away with the empty state: continue from the search box.
                      searchBox.current?.focus();
                    }}
                  >
                    {emptyFolder ? f.showAll : l.clearFilters}
                  </Button>
                }
              >
                {emptyFolder ? (applied.folder === NO_FOLDER ? undefined : f.emptyFolderIntro) : l.noResultsIntro}
              </EmptyState>
            ) : (
              <ul
                aria-busy={refreshing || undefined}
                inert={stale}
                className={`${listClass(view)} transition-opacity duration-200 ${stale ? "opacity-60" : ""}`}
              >
                {shown.map((code) => (
                  <li key={code.id}>
                    <CodeCard
                      code={code}
                      layout={view}
                      workspaceId={ws}
                      locale={locale}
                      t={t}
                      selected={selection.ids.has(code.id)}
                      busy={actions.busy}
                      onSelectedChange={selection.toggle}
                      onDownload={actions.download}
                      onToggleStatus={toggleStatus}
                      onDelete={deleteOne}
                      folderName={code.folder_id ? folderNames.get(code.folder_id) : undefined}
                      canEdit={canEdit}
                      onMove={canMove ? moveOne : undefined}
                      onEditLink={canEdit ? editLink : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}

            {state.kind === "ready" && state.moreFailed && (
              <div className="flex flex-col items-start gap-2">
                <FormAlert message={t.loadFailed} />
                <Button variant="secondary" onClick={loadMore}>
                  {t.retry}
                </Button>
              </div>
            )}
            {state.kind === "ready" && next && !state.moreFailed && !refreshing && (
              <Button variant="secondary" className="w-fit" busy={state.loadingMore} onClick={loadMore}>
                {t.loadMore}
              </Button>
            )}
          </section>
        )}
      </div>
      {withColumn && (
        <aside className="hidden border-r border-border px-3 lg:col-start-1 lg:row-start-1 lg:block">
          {/* The column runs the height of the page; its content stays in view and scrolls on its own. */}
          <div className="sticky top-0 max-h-dvh overflow-y-auto py-6">{folderNav()}</div>
        </aside>
      )}

      {/* Below `lg`: the folder column as a panel, with the status filter phones have no room for. */}
      <Drawer open={panelOpen && Boolean(hasCodes && ws)} title={l.filtersTitle} closeLabel={l.closePanel} onClose={() => setPanelOpen(false)}>
        <Select
          className="px-3"
          label={l.statusFilter}
          value={query.status}
          options={statusOptions(t)}
          onChange={(status) => changeQuery({ ...query, status })}
        />
        {folderNav()}
      </Drawer>

      {readyId && ws && (
        <ReadyDialog
          t={t}
          locale={locale}
          workspaceId={ws}
          id={readyId}
          onDownload={actions.download}
          onClose={() => {
            setReadyId(null);
            // The dialog was opened by the page itself, so there is no opener to return to:
            // continue from the list's heading rather than from the top of the page.
            setTimeout(() => heading.current?.focus());
          }}
        />
      )}
      {editingLink && ws && (
        <SlugDialog
          t={t}
          auth={auth}
          ws={ws}
          code={editingLink}
          onSaved={update}
          onClose={(saved) => {
            setEditingLink(null);
            if (saved) announce(t.linkSaved);
          }}
        />
      )}
      <MoveDialog
        t={t}
        pending={pendingMove}
        folders={folders.folders}
        locale={locale}
        onConfirm={(codes, target, bulk) => {
          setPendingMove(null);
          move(codes, target, bulk);
        }}
        onCancel={() => setPendingMove(null)}
      />
      <ConfirmDialog
        open={editing.pendingDelete !== null}
        title={editing.pendingDelete ? format(f.deleteTitle, { name: editing.pendingDelete.folder.name }) : ""}
        confirmLabel={f.deleteConfirm}
        cancelLabel={t.cancel}
        busy={editing.deleting}
        error={editing.pendingDelete?.error}
        onConfirm={editing.confirmDelete}
        onCancel={editing.cancelDelete}
      >
        {f.deleteBody}
      </ConfirmDialog>
      <ConfirmDialog
        open={actions.pendingDelete !== null}
        title={actions.pendingDelete?.title ?? ""}
        confirmLabel={l.deleteConfirm}
        cancelLabel={t.cancel}
        busy={actions.busy}
        error={actions.pendingDelete?.error}
        onConfirm={actions.confirmDelete}
        onCancel={actions.cancelDelete}
      >
        {l.deleteBody}
      </ConfirmDialog>
    </div>
  );
}

/**
 * The `ready` parameter as a code id, or null. It comes from the address, so anyone can put
 * anything there: only the shape of an id (a UUID) is ever sent to the API.
 */
function readyParam(value: string | null | undefined): string | null {
  return value && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

const PHONE = "(max-width: 639px)"; // below Tailwind's `sm`
const WIDE = "(min-width: 1024px)"; // Tailwind's `lg`

// Module-level, so `useSyncExternalStore` keeps one subscription across renders.
function subscribePhone(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isPhone = () => typeof window.matchMedia === "function" && window.matchMedia(PHONE).matches;
const notPhone = () => false;

/** True on a phone-width viewport; false on the server and where `matchMedia` is missing. */
function usePhone(): boolean {
  return useSyncExternalStore(subscribePhone, isPhone, notPhone);
}

function listClass(view: CodesView): string {
  return view === "grid" ? "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2";
}

/** Skeleton cards in the chosen layout; the page's status region says "loading" in words. */
function LoadingList({ t, view }: { t: T; view: CodesView }) {
  return (
    <ul aria-busy="true" aria-label={t.title} className={listClass(view)}>
      {Array.from({ length: view === "grid" ? 8 : 4 }, (_, i) => (
        <li
          key={i}
          className={`rounded-lg border border-border bg-surface p-3 ${view === "grid" ? "flex flex-col gap-3" : "flex items-center gap-4"}`}
        >
          <Skeleton className={view === "grid" ? "aspect-square w-full max-w-44 self-center" : "size-16 sm:size-20"} />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
