# Data layer: TanStack Query, piloted on the agenda (2026-11-14)

Repositories: vlr-web only. Branch: `feat/data-query-agenda`. Source: Fable front-end review
(finding: 264 useEffect, 50 of 67 pages fetch in effects; agenda ~11 requests/day, ~17/week;
`listCatalogOrders()` runs twice without a date range — `useAgendaDay.ts`, `useAgendaOptions.ts`).
Owner decision (2026-11-14): adopt TanStack Query as the app's data-fetching/cache layer, pilot on the
agenda, migrate other screens in later small PRs.

## Changes
1. Dependency: add `@tanstack/react-query` v5 (latest stable that is at least two weeks old; no devtools
   package). No other new deps.
2. `src/lib/queryClient.ts`: one `QueryClient` with defaults — `staleTime: 30_000`, `gcTime: 300_000`,
   `refetchOnWindowFocus: true`, `retry`: at most 1 retry, never on 4xx (use the axios error status),
   mutations `retry: 0`. Export `createQueryClient()` for tests.
3. Provider: `QueryClientProvider` in `src/main.tsx` inside the root `AppErrorBoundary` (from #574).
4. **Tenant isolation (hard rule):** every query key starts with `["tenant", tenantId ?? "none", ...]`
   (helper `tenantKey(tenantId, ...parts)` in `src/lib/queryKeys.ts`). Call `queryClient.clear()` on
   tenant enter/exit (platform admin), staff tenant switch and logout — find those flows
   (`enterTenantEnvironment`, exit, `refreshAuthSession`, sign-out) and hook the clear there. Customer
   portal sessions use their own tenant key too. Test: switching tenant never returns cached data from
   the previous tenant.
5. Services: add an optional `{ signal }: { signal?: AbortSignal } = {}` parameter to the service
   functions the agenda uses and pass it to axios; query functions pass the query's `signal`.
6. Agenda pilot (`src/features/agenda/useAgendaDay.ts`, `useAgendaOptions.ts`):
   - Static-ish lists as separate queries (rental assets, occupancy kinds, asset categories, catalog
     products) — shared by the options hook and the day/week hook (dedup by key).
   - Range data as queries keyed by range: catalog resource agenda (`from`,`to`), reservations
     (`from`,`to`), schedule day(s).
   - Orders for labels/search: **one** `listCatalogOrders({ from, to })` for the visible range (the API
     takes optional instants per the existing comment), reused by labels and the order search options.
   - Keep `failedSources` semantics per source (a failed query → that source in failedSources; others
     still render), loading semantics, and the same render output.
   - After agenda mutations that already exist (create reservation/block from the agenda flows),
     invalidate the affected range keys.
7. Test utility: `renderWithQuery()` in the test helpers (fresh client per test, `retry: false`).
   Update agenda tests to use it.
8. Docs: `docs/adr` or `docs/` short note "Data fetching convention" (keys, tenant rule, staleTime,
   when to invalidate, how to migrate a screen) — ≤ 1 page.

## Tests (write first)
- queryClient retry policy (no retry on 4xx, 1 on network/5xx).
- tenant key helper + clear on tenant switch (no cross-tenant cached data).
- agenda: orders requested once per range; day→week→day reuses cache; failedSources when one source
  fails; abort on unmount (signal passed).

## Checks
`npx vitest run --testTimeout=60000`, `npm run lint:ratchet` (the baseline may only shrink — removing
fetch effects should remove `set-state-in-effect` entries; if the ratchet allows shrinking via
`--write-baseline`, only shrink, never add), `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

## Done when
Checks pass; commit `feat(data): adopt TanStack Query, piloted on the agenda` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, open the PR to `develop` with
`gh pr create` (body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`),
and report the number of agenda requests per day/week view before and after (from the tests or a
network count). Do not merge.
