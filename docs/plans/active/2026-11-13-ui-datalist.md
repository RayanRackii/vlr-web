# PR 2 — DataList + FilterBar, piloted on reservations (2026-11-13)

Repositories: vlr-web only. Branch: `feat/ui-datalist`. Source plan: vlr-web#562 (PR 2 of 9),
following PR 1 (vlr-web#563: `components/layout/Page.tsx`, eslint guard with a legacy `ignores` list).
The owner approved PR 2.

## Goal
One shared list component: a real table on `md`+ (≥ 768px) and cards below, with loading, empty and
error rendered inside the same frame; one shared filter bar. Pilot on Reservas
(`src/features/rentals/pages/ReservationsPage.tsx` + `components/ReservationsList.tsx`) with the same
information and actions as today.

## Decisions (taken without the owner)
- `DataList` uses plain column definitions, no TanStack yet (no screen in this PR needs sorting).
- Desktop/mobile switch is CSS only (`hidden md:block` / `md:hidden`), no JS media queries.
- `md` is the single switch, per the plan.

## Changes
1. `src/components/data-table/DataList.tsx` (new):
   ```ts
   type DataListColumn<T> = { id: string; header: ReactNode; cell: (row: T) => ReactNode;
     align?: "start" | "end"; className?: string; hideBelow?: "lg" }   // hideBelow: column hidden under lg
   type DataListProps<T> = {
     label: string                       // accessible name (table aria-label / list aria-label)
     columns: DataListColumn<T>[]
     rows: readonly T[]
     getRowId: (row: T) => string
     renderCard: (row: T) => ReactNode   // mobile card body
     rowAttributes?: (row: T) => Record<`data-${string}`, string>  // e.g. data-status
     heading?: ReactNode                 // small line above the list (count, ordering)
     toolbar?: ReactNode                 // usually a FilterBar
     state?: "ready" | "loading" | "error"   // default ready
     error?: string; onRetry?: () => void     // required together when state="error" (discriminated union like Page)
     empty: EmptyStateProps-like ReactNode or props → render `EmptyState` (`@/components/ui/empty-state`) when rows is empty and state is ready
     loadingRows?: number                // skeleton rows, default 3
   }
   ```
   Frame: `rounded-xl border border-border bg-card text-card-foreground` (tokens only). Table built from
   `@/components/ui/table` (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`).
   Cards: `<ul role="list">` of `<li>` with `rounded-lg border border-border p-4` and `gap-3`.
   Loading: `Skeleton` rows inside the frame with `role="status"` and an sr-only label. Error:
   `ErrorState` with retry. Export the column/prop types.
2. `src/components/data-table/FilterBar.tsx` (new): props
   `{ label: string; search?: { value: string; onChange: (v: string) => void; placeholder: string; label: string }; filters?: ReactNode; chips?: { label: string; onRemove: () => void }[]; actions?: ReactNode; className?: string }`.
   `md`+: one wrapping row (search, filters, actions at the end). Below `md`: search full width, then
   filters and actions wrapping; no Sheet in this PR (keep it simple; note it as follow-up).
   Rendered as `<section aria-label={label}>` with the same frame tokens.
3. Reservations:
   - `ReservationsList.tsx`: render through `DataList` with the same six columns (time+duration,
     customer with initials, resources with `hideBelow: "lg"`, status badge, total aligned end,
     actions aligned end) and a `renderCard` showing time range, duration, customer, resources,
     status, total and actions. Keep `data-status` per row via `rowAttributes`. Keep the
     "count · date" and "ordered by time" heading via `heading`.
   - `ReservationsPage.tsx`: move loading / load error / empty into `DataList` props (`state`, `error`,
     `onRetry` = the page's existing reload, `empty`), keeping the same texts and the same empty-state
     actions. Wrap the existing filter controls (date navigation, view, status chips) in `FilterBar`
     via its `filters`/`actions` slots without changing their behaviour.
   - `reservations.css`: delete rules that only styled the old table, rows, skeleton rows, list
     surface and loading box; keep rules still used. No new feature CSS for layout the components
     now own.
4. Guard (`eslint.config.js`): extend the PR 1 `no-restricted-syntax` block for `src/features/**`
   with `JSXOpeningElement[name.name='table']` ("Use DataList from @/components/data-table") and
   an `ImportDeclaration[source.value='@tanstack/react-table']` restriction ("TanStack tables only
   inside src/components/data-table"). Files violating them today (AdminAssetFamiliesPage,
   AssetsPage, CatalogProductsPage, PeopleCustomersTab, PeopleUsersTab — verify by running lint)
   join the existing legacy `ignores` list **only for these new selectors** if the block structure
   allows; if a per-selector ignore is not possible in flat config, put the table/TanStack rules in a
   second block with its own legacy list. `.eslint-baseline.json` must not change (the ratchet
   refuses growth). Reservations files must have 0 violations.

## Tests (vitest; write first)
- `DataList.test.tsx`: table has the columns and one row per item (getRowId keys), cards list
  renders `renderCard` per item, `hideBelow` adds the class, empty state when rows = [], loading shows
  `role="status"` and not rows, error shows the message and calls `onRetry`, `rowAttributes` lands on
  the row.
- `FilterBar.test.tsx`: search calls `onChange`, chips call `onRemove`, slots render.
- Existing rentals reservations tests stay green; update selectors only where markup moved, keeping
  the same assertions about content and actions.

## Checks
`npx vitest run src/components/data-table src/features/rentals`, `npm run lint:ratchet`,
`npx tsc --noEmit -p .` (or the repo's typecheck), `npm run build`. Ignore the known local
`tokens:check` CRLF failure; do not touch generated tokens.

## Out of scope
Other features' tables (PR 3/4), sorting/pagination, a mobile filter Sheet, any API change.

## Done when
Checks pass; commit `feat(ui): add DataList and FilterBar and use them for reservations` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, PR to `develop` linking this spec,
vlr-web#562 and #563, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
Do not merge. The session does the DEV visual check after merge.
