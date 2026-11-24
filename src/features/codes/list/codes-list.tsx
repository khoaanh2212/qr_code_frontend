"use client";

import { CircleCheck, CircleX, Plus, QrCode, SearchX, Shapes } from "lucide-react";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ButtonLink, FormAlert } from "@/components/form/form-bits";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersonalWorkspace } from "@/features/auth/require-session";
import { format, localizePath, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { plural } from "@/i18n/plural";
import type { DynamicCode } from "@/lib/api/types";
import { CodeCard } from "./code-card";
import { CodesToolbar, SelectionBar } from "./codes-toolbar";
import { applyQuery, DEFAULT_QUERY, isDefaultQuery, needsAllPages, type CodeQuery } from "./query";
import { useCodeActions } from "./use-code-actions";
import { useCodes } from "./use-codes";
import { useCodesView, type CodesView } from "./use-codes-view";
import { useSelection } from "./use-selection";

type T = Messages["codes"];

const NO_CODES: readonly DynamicCode[] = [];

/**
 * The dashboard: the personal workspace's dynamic codes, with search, status filter, order,
 * list/grid layout, per-code actions and bulk pause, resume and delete.
 *
 * Composition only. Data (`useCodes`), what is shown (`applyQuery`), selection (`useSelection`),
 * actions (`useCodeActions`) and the layout preference (`useCodesView`) are separate hooks;
 * `CodesToolbar`, `SelectionBar` and `CodeCard` render props.
 */
export function CodesList({ t, templatesLabel, locale }: { t: T; templatesLabel: string; locale: Locale }) {
  const l = t.list;
  const workspace = usePersonalWorkspace();
  const ws = workspace?.id;
  const [query, setQuery] = useState<CodeQuery>(DEFAULT_QUERY);
  // Typing stays responsive on long lists: filtering follows at a lower priority.
  const applied = useDeferredValue(query);
  const loadAll = needsAllPages(applied);
  const { state, retry, loadMore, update, remove } = useCodes(ws, { loadAll });
  const [view, setView] = useCodesView();

  const codes = state.kind === "ready" ? state.codes : NO_CODES;
  const next = state.kind === "ready" ? state.next : null;
  const shown = useMemo(() => applyQuery(codes, applied, locale), [codes, applied, locale]);
  const shownIds = useMemo(() => shown.map((c) => c.id), [shown]);
  const selection = useSelection(shownIds);
  const selected = shown.filter((c) => selection.ids.has(c.id));
  const actions = useCodeActions({ workspaceId: ws, locale, t, update, remove, select: selection.set });

  // After a delete the cards (and the button that opened the dialog) are gone: continue from
  // the list's heading rather than from the top of the page.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (actions.deletions > 0) heading.current?.focus();
  }, [actions.deletions]);

  const { setStatus, askDelete } = actions;
  const toggleStatus = useCallback((c: DynamicCode) => setStatus([c], c.status === "paused" ? "active" : "paused", false), [setStatus]);
  const deleteOne = useCallback((c: DynamicCode) => askDelete([c]), [askDelete]);

  const newHref = localizePath(locale, "/app/codes/new");
  // Codes exist while any are listed or more pages remain (deleting a whole page fetches the next).
  const hasCodes = state.kind === "ready" && (codes.length > 0 || next !== null);
  const fetchingAll = loadAll && state.kind === "ready" && next !== null && !state.moreFailed;
  const summary = isDefaultQuery(applied)
    ? plural(locale, l.count, codes.length)
    : format(l.countFiltered, { shown: shown.length, total: codes.length });
  const activeSelected = selected.filter((c) => c.status === "active");
  const pausedSelected = selected.filter((c) => c.status === "paused");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-balance">{t.title}</h1>
          <p className="max-w-prose text-sm text-pretty text-muted">{t.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={localizePath(locale, "/app/templates")}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-medium hover:bg-foreground/5"
          >
            <Shapes aria-hidden="true" className="size-4" />
            {templatesLabel}
          </Link>
          {hasCodes && (
            <Link
              href={newHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t.newCode}
            </Link>
          )}
        </div>
      </header>

      {/* Live regions stay mounted, so screen readers hear each change of their text. */}
      <p role="status" className="sr-only">
        {state.kind === "loading" && workspace ? l.loading : fetchingAll ? l.loadingAll : ""}
      </p>
      <div role="status" className="flex flex-col gap-1 text-sm font-medium empty:hidden">
        {actions.notice.done && (
          <p className="flex items-center gap-2">
            <CircleCheck aria-hidden="true" className="size-4 text-accent" />
            {actions.notice.done}
          </p>
        )}
        {actions.notice.failed && (
          <p className="flex items-center gap-2 text-danger">
            <CircleX aria-hidden="true" className="size-4" />
            {actions.notice.failed}
          </p>
        )}
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
        <section aria-labelledby="codes-heading" className="flex flex-col gap-3">
          <h2 ref={heading} id="codes-heading" tabIndex={-1} className="sr-only">
            {t.title}
          </h2>
          <CodesToolbar t={t} query={query} onQueryChange={setQuery} view={view} onViewChange={setView} />
          <SelectionBar
            t={t}
            state={selection.state}
            count={selection.ids.size}
            summary={fetchingAll ? l.loadingAll : summary}
            onToggleAll={selection.toggleAll}
            onClear={selection.clear}
            onPause={activeSelected.length > 0 ? () => setStatus(activeSelected, "paused", true) : undefined}
            onResume={pausedSelected.length > 0 ? () => setStatus(pausedSelected, "active", true) : undefined}
            onDelete={() => askDelete(selected)}
            busy={actions.busy}
          />

          {shown.length === 0 && !fetchingAll && codes.length > 0 ? (
            <EmptyState
              icon={SearchX}
              title={l.noResults}
              action={
                <Button variant="secondary" onClick={() => setQuery({ ...DEFAULT_QUERY, sort: query.sort })}>
                  {l.clearFilters}
                </Button>
              }
            >
              {l.noResultsIntro}
            </EmptyState>
          ) : (
            <ul className={listClass(view)}>
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
          {!loadAll && state.kind === "ready" && next && !state.moreFailed && (
            <Button variant="secondary" className="w-fit" busy={state.loadingMore} onClick={loadMore}>
              {t.loadMore}
            </Button>
          )}
        </section>
      )}

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

function listClass(view: CodesView): string {
  return view === "grid" ? "grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "flex flex-col gap-2";
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
