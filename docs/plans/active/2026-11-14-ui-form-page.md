# PR 5 — FormPage, FormSection, FormRow (2026-11-14)

Repositories: vlr-web only. Branch: `feat/ui-form-page`. Source plan: vlr-web#562 (PR 5 of 9).
Builds on #563 (`components/layout/Page.tsx`) and the DataList PRs (#564–#569). Owner approved PR 5.

## Goal
One standard for create/edit form pages: page frame with form width, sections, a consistent field
row (label above control, hint, error under control), a sticky save bar and the unsaved-changes guard
— shared, not re-written per screen. Pilot on two screens with no behaviour change.

## Changes
1. Extract from `src/components/layout/EntityPage.tsx` (no behaviour change for its users
   `CatalogProductEditorPage`, `RoleEditorPage`):
   - `src/components/layout/UnsavedChangesGuard.tsx`: the existing `useBlocker` + `LeaveConfirmDialog`
     + `beforeunload` logic, props `{ when: boolean }` (keep the "only with a data router" handling).
   - `src/components/layout/SaveBar.tsx`: the existing sticky bottom bar (unsaved count text, Discard,
     Save `LoadingButton`), props `{ dirty, unsavedCount?, saving?, saveDisabled?, saveLabel?, onDiscard?, onSave?, submitFormId? }`.
     When `submitFormId` is set the Save button is `type="submit" form={submitFormId}` instead of
     `onClick`. Mobile (< 768px): buttons full width, primary first (top); `md`+: right-aligned row.
     Tokens only; touch targets ≥ 44px.
   - `EntityPage` uses both.
2. `src/components/layout/FormPage.tsx` (new):
   `{ header: PageHeaderProps; dirty: boolean; saving?: boolean; saveDisabled?: boolean; saveLabel?: string; unsavedCount?: number; onDiscard?: () => void; guardUnsaved?: boolean /* default true */ } & ({ onSave: () => void } | { submitFormId: string })`
   plus Page's `state`/`error`/`onRetry` union. Renders `<Page width="form" …>` + children +
   `SaveBar` (shown when `dirty` or always? — always show; Save disabled when `!dirty`, same as
   EntityPage) + `UnsavedChangesGuard when={guardUnsaved && dirty && !saving}`.
3. `src/components/ui/form-layout.tsx` (new):
   - `FormSection({ title, description?, actions?, children })`: `<section>` with
     `rounded-xl border border-border bg-card p-4 md:p-6 space-y-4`, title as `h2`
     (`text-base font-semibold`), description muted.
   - `FormGrid({ columns?: 1 | 2, children })`: `grid gap-4`, `sm:grid-cols-2` when 2.
   - `FormRow({ label, htmlFor, hint?, required?, error?, span?: 1 | 2, children })`: label above
     control (`Label` from `@/components/ui/label`), required marker, hint muted below label, error
     under control with `role="alert"` and `aria-describedby` wiring on the control id
     (`${htmlFor}-hint` / `${htmlFor}-error`); `span={2}` → `sm:col-span-2`.
   For react-hook-form screens keep `FormField`/`FormItem`/`FormLabel`/`FormMessage` from
   `@/components/ui/form` inside `FormSection`/`FormGrid` (no need for FormRow there).
4. Pilots (same fields, validation, texts, submit behaviour, navigation after save):
   - `src/features/pmoc/pages/CreatePlanPage.tsx` (react-hook-form): `FormPage` with
     `submitFormId` = its `<form id>`, sections via `FormSection`, field grids via `FormGrid`;
     remove its own `<h1>`/width wrapper and its own submit button area (the SaveBar replaces it).
   - `src/features/catalog/pages/CustomerGroupFormPage.tsx` (plain state, raw `<label>`s): `FormPage`
     with `submitFormId` or `onSave` (whichever matches today's flow), `FormSection` + `FormGrid` +
     `FormRow` replacing the raw labels.
   - `dirty` = the form's real dirty state (`formState.isDirty` / compare with initial values).
5. `eslint.config.js`: remove both pilots from `pageLegacy`; add a rule banning raw
   `JSXOpeningElement[name.name='label']` in `src/features/**` ("Use FormRow from
   @/components/ui/form-layout or FormLabel from @/components/ui/form"), with its own `formLegacy`
   list of the files that violate it today (generated, sorted, same comment style as the others, a
   separate block or the `scopedBlock` helper so coverage stays exact). Pilots must lint clean.
   `.eslint-baseline.json` unchanged.

## Tests (vitest; write first)
- `SaveBar`/`FormPage`: Save disabled when not dirty; `submitFormId` makes Save a submit button for
  that form; Discard calls `onDiscard`; guard mounts only when dirty (reuse EntityPage test patterns).
- `form-layout`: FormRow wires label `htmlFor`, hint and error ids into `aria-describedby`, error has
  `role="alert"`, `span={2}` class; FormSection renders an `h2`.
- `EntityPage` existing tests stay green.
- Pilots: existing tests stay green; add: single h1, submit through the SaveBar saves with the same
  payload, leaving with unsaved changes opens the leave dialog (if a data router test harness exists;
  otherwise assert guard `when`).

## Checks
`npx vitest run src/components/layout src/components/ui src/features/pmoc src/features/catalog --testTimeout=60000`,
`npm run lint:ratchet`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.
Ignore the local `tokens:check` CRLF failure.

## Out of scope
Wizards (PR 6), other forms, validation changes, API changes.

## Done when
Checks pass; commit `feat(ui): add FormPage and form layout and pilot them` (body +
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, PR to `develop` linking this spec and
#562, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
