# PR 4c — Assets inventory on Page + DataList with selection (2026-11-13)

Repositories: vlr-web only. Branch: `refactor/assets-datalist`. Source plan: vlr-web#562 (PR 4, last
of 3). Builds on #563 (`Page`), #564/#566 (`DataList`, `FilterBar`), #568 (DataList `selection` prop),
#567 (admin families: same filter pattern). Owner approved PR 4.

## Decisions (same as 4a/4b)
- Header column filters (`DataTableColumnFilterHeader` on name, tag, category, location) move to the
  page's `FilterBar`: one `search` matching name OR tag (case-insensitive, trimmed), plus compact
  filters for category and location (a `Select` each, options from the loaded rows; "All" default),
  and status if useful as chips. Active filters as removable `chips`. Plain `useMemo` filtering.
  Same pattern as `src/features/admin/pages/AdminAssetFamiliesPage.tsx` and
  `src/features/catalog/pages/CatalogProductsPage.tsx`.
- Row selection for the bulk actions uses DataList's `selection` prop (`selectedIds`/`onChange`/
  `rowLabel`/`selectAllLabel`), replacing TanStack `rowSelection`. Selection keeps working on mobile
  cards. Select-all acts on the visible (filtered) rows.

## Changes
1. `src/features/assets/pages/AssetsPage.tsx`:
   - Page frame: replace the hand-written `<h1>` block (~line 689) and any `mx-auto max-w-*` with
     `<Page header={{ title, description, icon?, actions }}>`; same texts and header actions
     (create, bulk create, etc.).
   - List: `DataList` with the same columns (name, tag, category, location, status, row actions
     DropdownMenu), `hideBelow: "lg"` on secondary columns, `renderCard` with the same data, the row
     actions menu and the selection checkbox (cards `min-w-0`, `[overflow-wrap:anywhere]`, 44px
     targets), `heading`, loading (replace `TableRowsSkeleton`/`RecordListSkeleton`), error+retry and
     empty (map today's `EmptyState` props, including filtered-empty wording).
   - Bulk bar: keep today's bulk actions UI and logic (count, schedule/permanent split, confirm
     phrase, bulk delete) driven by the new selected-id set; derive `selectedRows` from ids ∩ loaded
     rows. Clear selection after a successful bulk action and when rows reload.
   - Wizard/dialogs (create/bulk/edit, delete) unchanged.
   - Remove `useReactTable`, `@tanstack/react-table` and `DataTableColumnFilterHeader` imports.
2. `eslint.config.js`: remove `AssetsPage.tsx` from `pageLegacy` and `tableLegacy`; the file lints
   clean (justified `eslint-disable-next-line react-hooks/set-state-in-effect` only if the React
   Compiler surfaces one on an existing load effect, like 4a/4b). `.eslint-baseline.json` unchanged.
   If `tableLegacy` becomes empty, keep the guard working (the `scopedBlock` helper skips empty blocks).
3. If `src/components/data-table/data-table-column-filter-header.tsx` is then unused anywhere, delete
   it and its test; otherwise leave it.

## Tests (vitest; update the three existing AssetsPage test files, write first where behaviour moves)
- Layout: single h1 from Page; rows in the table (`within(getByRole("table"))`); cards list present.
- Filters: search by name and by tag; category and location filters narrow rows; chips clear them.
- Selection + bulk: selecting two rows shows the bulk bar with the right count; select-all selects
  the visible rows only; bulk delete flow (confirm phrase when needed) still calls delete for the
  selected ids and clears the selection; selection via a card checkbox works.
- Access test: permission-gated actions unchanged.

## Checks
`npx vitest run src/features/assets src/components/data-table --testTimeout=60000`,
`npm run lint:ratchet`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.
Ignore the local `tokens:check` CRLF failure.

## Done when
Checks pass; commit `refactor(assets): inventory on Page and DataList with selection` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, PR to `develop` linking this spec,
#562 and #568, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
Do not merge.
