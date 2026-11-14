# Lazy-load route pages and non-default locales (2026-11-14)

Repositories: vlr-web only. Branch: `perf/lazy-routes-locales`. Source: Fable front-end review
(owner approved), finding "no code splitting: 0 lazy/Suspense; AppRoutes imports 14 manifests
statically; 785 KB of locale JSON eager; framer-motion only used by landing".

## Goal
Each screen's code downloads only when opened; only the active language's strings load.
No behaviour change.

## Changes
1. Route elements lazy: keep every `src/features/*/manifest.tsx` eager (navigation items, permissions,
   module gating stay synchronous), but replace each page component used as a route `element` with
   `React.lazy(() => import("./pages/X").then(m => ({ default: m.X })))` (named exports) — one helper
   e.g. `lazyPage(() => import(...), "X")` in `src/routes/lazyPage.ts` to avoid repetition. Landing
   (`features/landing`) and admin pages must end up in their own chunks.
2. One `Suspense` boundary around the routed outlet in `MainLayout` (and the public/portal layouts if
   they render routes) with the existing `PageContentSkeleton` as fallback (no full-screen spinner,
   no layout shift of the shell/sidebar). Keep `ProtectedRoute`/`PermissionRoute` semantics.
3. Locales: keep `pt-BR` bundled (default + fallback). Load `en` and `es` (`common.json` +
   `permissionCopy`) with dynamic `import()` when the detected/selected language needs them, via
   `i18n.addResourceBundle` before `changeLanguage` resolves (or i18next's `resourcesToBackend`
   if already a dependency — do not add new dependencies). Language switcher keeps working; no flash
   of raw keys (wait for the bundle, then switch).
4. Tests: the vitest setup must keep all locales available synchronously (import them in the test
   setup) so existing tests don't change. Add tests: `lazyPage` resolves a named export; switching to
   `en` loads the bundle once and translates; route renders the fallback then the page.
5. Verify chunks: run `npm run build` and report the main entry chunk size before/after and the
   list of the 10 largest chunks (from Vite output). Keep the entry chunk smaller than before.

## Out of scope
Removing dependencies, error boundaries, timeouts (separate PR), any page redesign.

## Checks
`npx vitest run --testTimeout=60000` (full suite: lazy changes touch routing), `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Local `tokens:check` CRLF failure known.

## Done when
Checks pass; commit `perf(app): lazy-load route pages and non-default locales` (body + sizes before/after
+ `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, open the PR to `develop` with
`gh pr create` (body with the size table, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Do not merge.
