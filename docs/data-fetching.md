# Data fetching convention (TanStack Query)

Status: adopted 2026-11-14, piloted on the agenda (`src/features/agenda`). Other screens migrate in later small PRs.

## Setup
- `src/lib/queryClient.ts`: one client. `staleTime` 30 s, `gcTime` 5 min, `refetchOnWindowFocus` on,
  at most 1 retry and only for network errors and 5xx (never 4xx or parse errors), mutations never retry.
- `QueryClientProvider` lives in `src/main.tsx`, inside `AppErrorBoundary`.

## Keys and the tenant rule (mandatory)
- Every key is built with `tenantKey(tenantId, ...parts)` (`src/lib/queryKeys.ts`) and starts with
  `["tenant", tenantId ?? "none", ...]`. Never write a raw key. Include every input of the request
  (range, filters, ids) in the key.
- The whole cache is cleared (`clearQueryCache()`) on login, logout, tenant enter/exit/switch of a
  platform admin (all go through `invalidateCurrentUserCache()` in `currentUserCache.ts`, plus the
  local exit/enter markers) and on customer portal session changes. A new auth flow that changes the
  tenant must call it too.

## Writing a query
- Put `queryOptions` builders next to the feature (`agendaQueries.ts`). The `queryFn` takes `{ signal }`
  and passes it to the service (services accept `{ signal }: { signal?: AbortSignal } = {}`), so unmounts abort.
- Two hooks that need the same data use the same builder: they share one request. Derive shapes with a
  module-level `select`, not a second request.
- Data that other screens can change (ranges, lists) sets `refetchOnMount: "always"`; static lists keep the default.
- One source per query: a failed query only marks its own source, the rest still render.

## Invalidation
After a mutation, `queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, "<resource>") })` with
the narrowest prefix that covers what changed (a prefix matches all ranges of that resource).

## Migrating a screen
1. Move each `useEffect` fetch to a query (`queryOptions` + `useQuery`/`useQueries`), key via `tenantKey`.
2. Delete the loading/error `useState` pairs; use `isPending`/`isError` per source.
3. Tests: `renderWithQuery()` from `src/test/renderWithQuery.tsx` (fresh client, `retry: false`).
