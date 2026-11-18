# PR 4a — DataList selection + catalog products on DataList (2026-11-13)

Repositories: vlr-web only. Branch: `refactor/catalog-datalist`. Source plan: vlr-web#562 (PR 4).
Builds on #563 (Page), #564 (DataList/FilterBar), #565/#566 (People + mobile fix). Owner approved PR 4.

## Decisions (taken by the session, apply to PR 4a/4b/4c)
- Per-column header filters (`DataTableColumnFilterHeader`, TanStack `columnFilters`) move to the
  page's `FilterBar` (`filters` slot: selects/segmented chips). Reason: on < 768px DataList shows cards
  with no header, so header filters would disappear on mobile. Filtering becomes plain array filtering
  in the page (`useMemo`); no TanStack in features.
- `DataList` gains optional row selection (used by AssetsPage in 4c; built and tested here).

## Changes
1. `src/components/data-table/DataList.tsx` — optional selection props (all-or-nothing):
   `selection?: { selectedIds: ReadonlySet<string>; onChange: (next: Set<string>) => void; rowLabel: (row: T) => string; selectAllLabel: string }`.
   Table: first column with a `Checkbox` (`@/components/ui/checkbox` if present, else a native input
   styled with tokens) per row (`aria-label={rowLabel(row)}`) and a header checkbox selecting/clearing
   all visible rows (indeterminate when partial). Cards: the same per-row checkbox at the card's top
   start, min 44px touch target. No selection props → no checkbox column (existing users unchanged).
2. `src/features/catalog/pages/CatalogProductsPage.tsx` — render the products list with `DataList`
   (same columns: name, code, access, price, status, categories, tags, actions; hide the less important
   ones below `lg` with `hideBelow`), a `renderCard` with the same data and actions, `heading`, states
   (loading / error+retry / empty via the existing catalog empty content mapped to `EmptyStateProps`).
   Replace `columnFilters` + header filters with `FilterBar`: keep the existing search
   (`CatalogSearch`/global filter) in `FilterBar.search` if it fits, and put the former column filters
   (status, access/visibility, category, tag — whatever exists today) as compact `Select`s or chips in
   `filters`; active filters as `chips` with remove. Same filtering semantics as today. Remove
   `useReactTable`/`@tanstack/react-table` from the page.
3. `src/features/catalog/components/StaffCatalogChrome.tsx` — remove `CatalogColumnFilter` (and its
   `@tanstack/react-table` type import) if nothing else uses it; keep the other exports.
4. `eslint.config.js` — remove `CatalogProductsPage.tsx` and `StaffCatalogChrome.tsx` from
   `tableLegacy`; both lint clean. `.eslint-baseline.json` unchanged.
5. Delete catalog CSS that only styled the old table/header filters (verify unused in src and e2e).

## Tests (vitest; write first)
- `DataList.test.tsx`: no selection → no checkboxes; with selection → row checkbox toggles the id;
  header checkbox selects all / clears all and is indeterminate when partial; card checkbox toggles.
- Catalog products page test (existing or new): rows render in the table; each former column filter
  now in the filter bar narrows rows the same way; chip remove clears it; search still works; empty
  and error+retry states. Scope table queries with `within(getByRole("table"))`.

## Checks
`npx vitest run src/components/data-table src/features/catalog`, `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Ignore the local `tokens:check` CRLF failure.

## Done when
Checks pass; commit `refactor(catalog): products list on DataList with filter bar` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, PR to `develop` linking this spec and
#562/#564, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
