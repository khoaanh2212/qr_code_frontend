# UI components

Design-system pieces of the customer app. They know nothing about QR codes, the API or messages:
every visible string comes in through props (from `src/i18n/messages`), so they work in all six
languages. Tokens and rules come from `DESIGN.md` (Signal Teal as the only accent, Control Edge
borders on anything interactive, 44px targets, shadows only on floating layers).

Feature code lives in `src/features/<feature>` and composes these; see
`src/features/codes/list/` for a full example.

## Rules for every component

- **Native first.** A `<button>`, `<input type="checkbox">`, `<select>`, radio group or `<dialog>`
  before any ARIA role: keyboard, focus and screen-reader behavior come for free.
- **A name is required.** Icon-only controls take a `label` prop (not optional), used as
  `aria-label` and tooltip. Icons are always `aria-hidden`.
- **Controlled.** Components take `value` and an `onChange`/`onValueChange`; state lives in the
  feature. Generic value types (`Select<T>`, `SegmentedControl<T>`) keep `onChange` from handing
  back a string outside the options.
- **States are part of the API.** `busy` (inert but focusable while a request runs), `disabled`
  (with the reason written nearby), `error`, `indeterminate`.
- **No user content as HTML.** Names, URLs and messages render as text; never
  `dangerouslySetInnerHTML`.
- **Motion** stays 150–250ms, on state changes only, and stops under `prefers-reduced-motion`.

## Components

| Component | Purpose | Key props |
|---|---|---|
| `Button` | Primary / secondary / danger action | `variant`, `busy` |
| `IconButton` | Icon-only action, 44px | `label` (required), `icon` |
| `Checkbox` | Native checkbox in a 44px label | `label`, `hideLabel`, `indeterminate` |
| `Menu`, `MenuItem`, `MenuSeparator` | Actions menu (WAI-ARIA menu button) | `label`, `align`; item `onSelect`, `icon`, `tone`, `disabled` |
| `SegmentedControl<T>` | 2–3 exclusive options (radio group) | `legend`, `value`, `options`, `onChange`, `hideLabels` |
| `SearchField` | Search box with icon | `label`, `value`, `onValueChange` |
| `Select<T>` | Native select | `label`, `hideLabel`, `value`, `options`, `onChange` |
| `EmptyState` | "Nothing yet" / "nothing matches", with the next step | `icon`, `title`, `action`, `as` |
| `Skeleton` | Loading placeholder (hidden from assistive tech) | `className` |
| `ConfirmDialog` | Modal confirmation for irreversible actions | `open`, `title`, `busy`, `error`, `onConfirm`, `onCancel` |
| `CopyButton` | Copy to clipboard with announced result | `value`, `label`, `copiedLabel`, `failedLabel` |
| `TextField` | Labelled text input with help and error | see `text-field.tsx` |

## Usage

### Actions menu

```tsx
<Menu label={format(t.list.actions, { name })}>
  <MenuItem icon={Download} onSelect={() => download("png")}>{t.list.downloadPng}</MenuItem>
  <MenuSeparator />
  <MenuItem icon={Pause} disabled={locked} onSelect={pause}>{t.list.pause}</MenuItem>
  <MenuSeparator />
  <MenuItem icon={Trash2} tone="danger" onSelect={askToDelete}>{t.list.delete}</MenuItem>
</Menu>
```

Keyboard: Enter / Space / ArrowDown open on the first item, ArrowUp on the last; arrows, Home and
End move; Escape closes and refocuses the button; Tab or a click outside closes. Choosing an item
closes the menu and refocuses its button before running the action, so a dialog opened from the
menu hands focus back to the button when it closes. Keep `danger` items last.

### Confirming a delete

```tsx
<ConfirmDialog
  open={pending !== null}
  title={format(t.list.deleteOneTitle, { name })}
  confirmLabel={t.list.deleteConfirm}
  cancelLabel={t.cancel}
  busy={deleting}
  error={deleteError}            // keeps the dialog open; the person can retry or cancel
  onConfirm={confirm}
  onCancel={() => setPending(null)}
>
  {t.list.deleteBody}
</ConfirmDialog>
```

Cancel has focus first; Escape cancels (except while `busy`). Use it only where protected focus is
the point (irreversible actions); anything else stays inline.

### Select all with a partial selection

```tsx
<Checkbox
  label={t.list.selectAll}
  hideLabel
  checked={state === "all"}
  indeterminate={state === "some"}
  onChange={toggleAll}
/>
```

### Typed options

```tsx
type Sort = "newest" | "oldest" | "name";
<Select<Sort> label={t.list.sort} hideLabel value={sort} options={sorts} onChange={setSort} />
```

## Testing

Each component has behavior tests in `ui.test.tsx` (Vitest + Testing Library, jsdom): queries by
role and name, keyboard paths, and the states above. jsdom has no `HTMLDialogElement.showModal`;
the test file stubs it. Visual and layout checks happen in a real browser (CLAUDE.md, "Smoke
tests").
