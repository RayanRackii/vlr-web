# Data fetching convention (TanStack Query)

Status: adopted 2026-11-14, piloted on the agenda (`src/features/agenda`). Other screens migrate in later small PRs.

## Setup
- `src/lib/queryClient.ts`: one client. `staleTime` 30 s, `gcTime` 5 min, `refetchOnWindowFocus` on,
  at most 1 retry and only for network errors and 5xx (never 4xx, timeouts or parse errors), mutations never retry.
- `QueryClientProvider` lives in `src/main.tsx`, inside `AppErrorBoundary`.

## Keys and the tenant rule (mandatory)
- Every key is built with `tenantKey(audience, tenantId, ...parts)` (`src/lib/queryKeys.ts`) and starts with
  `["tenant", audience, tenantId ?? "none", ...]`. `audience` is `"staff"` (Supabase staff session) or
  `"customer"` (customer portal token), so the two kinds of session never share cache entries even for the
  same tenant. Never write a raw key. Include every input of the request (range, filters, ids) in the key.
- The whole cache is cleared (`clearQueryCache()`) only when the session identity or tenant really changes:
  login/logout and tenant change (`syncCurrentUserCacheToAuthUser`, fingerprint change), platform tenant
  enter/exit (`refreshAuthSession`, exit/enter markers), session restore, and customer portal session
  keys (`rolvix.customer.*`). A forced profile/permission refresh (`getCurrentUser({ force: true })`)
  does not clear it. A new auth flow that changes the tenant must call `clearQueryCache()`.
- Check what a server filter means before putting it in a key or a request: e.g. `listCatalogOrders`
  `from`/`to` filter by order creation date, not by service date.

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
