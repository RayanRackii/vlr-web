# PR 4b — Admin asset families on Page + DataList (2026-11-13)

Repositories: vlr-web only. Branch: `refactor/admin-families-datalist`. Source plan: vlr-web#562 (PR 4).
Builds on #563 (`components/layout/Page.tsx`), #564/#566 (`components/data-table/DataList.tsx`,
`FilterBar.tsx`). Runs in parallel with PR 4a (catalog). Owner approved PR 4.

## Decisions (same as 4a)
- Per-column header filters (`DataTableColumnFilterHeader`, TanStack `columnFilters`) move to the
  page's `FilterBar` (`filters` slot), because DataList cards (< 768px) have no header. Filtering is
  plain array filtering in the page (`useMemo`); no TanStack in features.
- No row selection needed here.

## Changes
1. `src/features/admin/pages/AdminAssetFamiliesPage.tsx`:
   - Page frame: replace the hand-written title block (`<h1>` and any `mx-auto max-w-*` wrapper) with
     `<Page header={{ title, description, icon?, actions }}>` keeping the same texts and header actions.
     Use `state`/`error`/`onRetry` of `Page` only for a whole-page load failure if that exists today.
   - List: `DataList` with the same columns and row actions as today, sensible `hideBelow: "lg"` on
     secondary columns, a `renderCard` with the same data/actions (cards `min-w-0`, long text wraps
     with `[overflow-wrap:anywhere]`, full-width card buttons), `heading`, loading / error+retry /
     empty mapped from what the page shows today.
   - Filters: the former column filters (and search, if any) become `FilterBar` controls with active
     `chips`; same filtering semantics. Remove `useReactTable` / `@tanstack/react-table`.
   - Dialogs/forms on this page (create/edit/delete) unchanged.
2. `eslint.config.js`: remove `AdminAssetFamiliesPage.tsx` from both `pageLegacy` and `tableLegacy`;
   the file must lint clean. `.eslint-baseline.json` unchanged.
3. Delete CSS that only styled the old table/header (verify unused in src and e2e).

## Tests (vitest; write first)
Page test (existing or new): title renders as the single h1; rows render in the table (scope with
`within(getByRole("table"))`); each former column filter in the filter bar narrows rows the same way
and its chip clears it; empty and error+retry states; one row action still opens its dialog.

## Checks
`npx vitest run src/features/admin src/components/data-table`, `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Ignore the local `tokens:check` CRLF failure.

## Done when
Checks pass; commit `refactor(admin): asset families on Page and DataList` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, PR to `develop` linking this spec and
#562, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
If `eslint.config.js` later conflicts with PR 4a, the session will ask you to rebase.
