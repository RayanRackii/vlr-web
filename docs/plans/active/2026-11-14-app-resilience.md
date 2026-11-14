# App resilience: error boundary, request timeout, unused deps (2026-11-14)

Repositories: vlr-web only. Branch: `fix/app-resilience`. Source: Fable front-end review (owner
approved): "0 error boundaries (a render bug = blank page); no axios timeout (`src/lib/api.ts:88-95`);
`recharts`, `@tanstack/react-table`, `@tanstack/react-virtual` have 0 imports".

## Changes
1. Error boundary: `src/components/layout/AppErrorBoundary.tsx` (class component, the only one), with
   a friendly fallback using the existing `ErrorState` ("Algo deu errado nesta tela" + "Tentar de novo"
   that resets the boundary, and "Voltar ao início" link), i18n keys in pt-BR/en/es. Mount: one around
   the routed content inside `MainLayout` (so the shell/sidebar survives) and one at the app root as
   last resort. Reset the inner boundary on route change (key by `location.pathname`). Log the error
   with the existing logging approach if there is one (e.g. `console.error`), never send PII.
2. Request timeout: default `timeout: 30_000` on the axios instances in `src/lib/api.ts` (staff,
   customer, public). Map axios `ECONNABORTED`/timeout to the existing user-facing network error text
   (reuse `apiErrorText` helpers; add one i18n key if needed). Long operations (uploads/exports — grep
   for file uploads) may pass a larger per-request timeout; keep them working.
3. Unused deps: remove `recharts`, `@tanstack/react-table`, `@tanstack/react-virtual` from package.json
   **only after** grepping src, e2e, scripts and config for any import (report counts). Update the
   lockfile with `npm uninstall`. If any is used anywhere, keep it and say so.
4. Tests: boundary renders fallback when a child throws, retry re-renders, route change resets;
   api timeout config present and timeout error maps to the friendly text.

## Checks
`npx vitest run --testTimeout=60000`, `npm run lint:ratchet`, `npx tsc --noEmit -p tsconfig.app.json`,
`npm run build`. Local `tokens:check` CRLF failure known.

## Done when
Checks pass; commit `fix(app): add error boundaries, request timeout and drop unused deps` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, open the PR to `develop` with
`gh pr create` (body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Do not merge.
