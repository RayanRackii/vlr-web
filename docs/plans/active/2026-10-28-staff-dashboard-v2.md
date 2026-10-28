# Staff dashboard v2 — implementation plan

**Goal:** Implement the approved `/workspace/rolvix-synthetic-evidence/t1140-staff-dash/dash.html` using existing dashboard data and portal visual conventions.

**Architecture:** Keep role dispatch, requests, readiness and shell behavior. Compose a staff-only hero, navigation shortcuts, compact KPIs and accessible CSS charts using shared tokens and primitives. Reuse canonical navigation filtering; add no access rules, routes, dependencies or API calls.

**Constraints:** Work only in this worktree; no Git; Node 22; do not modify the node_modules symlink or its target. Every new string in pt-BR/en/es. Reduced motion, dark theme, one h1 and 44px targets. No browser checks in this sandbox.

**Review focus:** Module combinations and restricted links; loading/error/retry and genuine zero values; readiness links and scoped trial notice; stable status colors and textual chart values; responsive sizing at 393/820/1440/2560px.

- [x] Test observable heading and permitted links, observe failure, implement hero and shortcuts.
- [x] Test pulse totals, status values and empty/error behavior; implement approved KPI/chart layout and translations.
- [x] Verify TypeScript, targeted then full Vitest, touched-file ESLint and lint ratchet; review final files and add one ROADMAP history line.

The approved mockup is the design decision; no new domain or architecture decisions are needed. Test seams are the rendered headings, links and states requested by the user. Preserve additional existing PMOC indicators when that module is loaded.

Review: no Standards findings; corrected QHD left alignment from Spec review. Count-up remains omitted under the user's optional-motion constraint; entrance staggering and hover lift honor reduced motion. Source-only review; no Git revision or browser verification.

Validation (Node 22): TypeScript passed; targeted Vitest including readiness/trial/home routing passed (80 tests, 15 files), then full suite passed (2396 tests, 270 files). ESLint has no new errors; the original role-dispatch `react-hooks/set-state-in-effect` finding remains. Lint ratchet passed with 192 existing violations. CSS parsed successfully. Visual checks are pending in a browser-capable environment; no mockup element was omitted for unavailable data.
