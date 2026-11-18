# PR 3 — People lists on DataList (2026-11-13)

Repositories: vlr-web only. Branch: `refactor/people-datalist`. Source plan: vlr-web#562 (PR 3 of 9).
Builds on vlr-web#563 (Page) and vlr-web#564 (`src/components/data-table/DataList.tsx`, `FilterBar`).
The owner approved PR 3.

## Goal
The two People & Access tabs (`src/features/users/components/PeopleUsersTab.tsx`,
`PeopleCustomersTab.tsx`) render their lists through `DataList` instead of hand-made
`<table className="people-table …">`, with the same information, links, actions, texts and
behaviour. Their hand-made table/list CSS in `src/features/users/people-access.css` goes away.

## Changes
1. Both tabs: replace the `people-directory` section + `people-table` with `DataList`:
   - Same columns as today (read the current `<th>` list), identity cell with initials avatar +
     name (+ link for customers to `/pessoas-e-acesso/clientes/{id}`, min touch height kept) + email,
     dates, status, actions; actions aligned end. A `renderCard` with the same fields for < 768px,
     replacing the `people-mobile-*` labels trick.
   - `heading` = today's `people-list-heading` content.
   - Loading → `state="loading"` (replace the `PageContentSkeleton rows={4}` placed above the list),
     load error with no rows → `state="error"` with the message and `onRetry` = the tab's existing
     reload; keep an inline `Alert` only if today it can appear together with rows.
   - Empty → `empty` props: map what `PeopleEmptyState` shows today (title, description, action such
     as invite) onto `EmptyStateProps`. If `PeopleEmptyState` carries something `EmptyStateProps`
     cannot express, keep the content identical by extending the props minimally and say so; if it
     becomes unused, delete it and its test.
   - Keep each tab's own search component as is (it has an action button and an error message that
     `FilterBar` does not support yet); render it above the `DataList`, outside any `aria-busy`.
2. `people-access.css`: delete rules that only styled the old table/list (`people-table*`,
   `people-directory`, `people-list-heading`, `people-identity-cell`, `people-mobile-*`, etc. — verify
   each selector is unused in `src` and `e2e` before deleting). Keep rules still used elsewhere.
   Update `people-access.css.test.ts` so it asserts on rules that still exist (do not weaken unrelated
   assertions; if it asserted on deleted table rules, replace those assertions with DataList-level
   behaviour tests in the tab tests).
3. `eslint.config.js`: remove `PeopleUsersTab.tsx` and `PeopleCustomersTab.tsx` from `tableLegacy`
   (and from `pageLegacy` only if they no longer violate the page rules). Both files must lint clean.
   `.eslint-baseline.json` must not change (CI refuses growth).

## Tests (vitest; write first where behaviour moves)
- `PeopleCustomersTab.test.tsx` and a users-tab test (existing file or new): rows render in the table
  with name/email/status and the customer link; loading shows `role="status"`; load error without
  rows shows the message and Retry reloads; empty shows the same title/action as today. Scope table
  queries with `within(getByRole("table"))` since cards are also in the DOM.
- Existing `PeopleAccessPage.test.tsx`, `PeopleMobileActions.test.tsx`, `PeopleBottomNavigation.test.tsx`
  stay green.

## Checks
`npx vitest run src/features/users src/components/data-table`, `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Ignore the known local `tokens:check`
CRLF failure.

## Out of scope
Search → FilterBar, other features, API changes, visual redesign beyond the DataList standard.

## Done when
Checks pass; commit `refactor(users): people lists on DataList` (body + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`),
push, PR to `develop` linking this spec and vlr-web#562/#564, body ending with
`🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
