# UI standard patterns: audit, standard and migration plan

- Repositories: `vlr-web` only
- Status: proposal (no source code changed)
- Mockup: [`2026-11-13-ui-standard-patterns-mockup.html`](./2026-11-13-ui-standard-patterns-mockup.html)
- Scope measured: `src/features/**/*.tsx` without tests (228 files, 19 features), plus `src/components`

## Executive summary

- The feeling is right: screens do not share one pattern. Only 6 of 19 features use the shared page header; the other 13 write their own title block (53 hand-written titles in 45 files).
- The building blocks mostly exist already (page header, empty state, error state, loading skeleton, wizard, table). The problem is low adoption, not missing design.
- Lists are the weakest area. There is no shared list component: 3 pages wire the table library by hand, 3 use plain HTML tables with their own CSS, and the rest are hand-made card lists.
- "Boxes" are the biggest duplication: 226 hand-made bordered boxes in 91 files, against 38 uses of the shared Card.
- There are two competing wizard components and at least three more hand-made steppers; the "official" wizard is used once.
- Phone behaviour is decided screen by screen: three different mechanisms and five different "phone width" values are in use.
- Proposal: one page shell and three page types (List, Form, Wizard), built by promoting existing components plus four small new ones. See the mockup.
- Delivery: 9 small PRs, each with an automatic guard so that old patterns cannot come back. Nothing visual changes for customers until each PR is reviewed.

## 1. Inventory of page archetypes

"Features" = number of the 19 feature folders that use it.

| Archetype | Shared component | Uses it | Rolls its own |
|---|---|---|---|
| Page shell / header | `layout/PageHeader` (title, description, icon, actions) | 18 files, 6 features | 53 raw `<h1>` in 45 files, 13 features; page width set by hand in 46 files |
| List: table | `ui/table` + `data-table/data-table-column-filter-header` (a header cell only; no `DataTable`) | 4 pages, 3 features; `useReactTable` wired 4 times in 3 pages | 3 raw `<table>` with feature CSS |
| List: cards / rows | none | n/a | `<ul>/<ol>` in 63 files, 15 features; `grid-cols-*` grids in 53 files |
| Detail / edit | `layout/EntityPage` (tabs, dirty state, sticky save bar) | 2 pages | all other editors |
| Form | `ui/form` (react-hook-form), `FormPrimaryButton`, `LoadingButton` | `Form` 33 files; `FormPrimaryButton` 34 files | raw `<form>` in 41 files; 3 label styles (`Label` 16 files, `FieldLabel` 3, hand-made `block font-medium text-sm` 11 hits) |
| Wizard | `wizard/Wizard` and `ui/wizard-panels` (4 stepper variants) | `Wizard` 1 page; `WizardPanelsStepper` 3 features | 3+ hand-made steppers |
| Dashboard | `ui/card` | 38 uses, 19 files | 226 hand-made bordered boxes, 91 files |
| Empty | `ui/empty-state` | 25 uses, 18 files, 8 features | inline grey paragraphs (11+ hits of two class strings) |
| Loading | `loading/PageContentSkeleton`, `ui/skeleton` | 26 files, 8 features | ad-hoc skeletons and spinners elsewhere |
| Error | `ErrorState` (message + retry), `ui/alert` | `ErrorState` 9 files, 3 features; `Alert` 18 files | 29 hand-made red boxes in 19 files, 8 features |

Representative examples:

- Header, shared: any `<PageHeader>` in catalog, rentals, users. Own: `src/features/agenda/AgendasPage.tsx:43`, `src/features/pmoc/pages/CreatePlanPage.tsx:219`, `src/features/catalog/pages/PedidosPage.tsx:50`, `src/features/rentals/pages/RentalResourcesPage.tsx:126` (unstyled `<h1>`, styled from a CSS file).
- Table, shared primitives: `src/features/assets/pages/AssetsPage.tsx:463,776`, `src/features/admin/pages/AdminAssetFamiliesPage.tsx:341,466`, `src/features/catalog/pages/CatalogProductsPage.tsx:298,345`. Raw: `src/features/rentals/components/ReservationsList.tsx:40`, `src/features/users/components/PeopleCustomersTab.tsx:160`, `src/features/users/components/PeopleUsersTab.tsx:278`.
- Edit page, shared: `src/features/catalog/pages/CatalogProductEditorPage.tsx:693`, `src/features/users/pages/RoleEditorPage.tsx:263`.
- Wizard, shared: `src/features/rentals/pages/RentalLayoutsPage.tsx:184` (`Wizard`); `src/features/assets/components/AssetWizard.tsx:668`, `src/features/admin/components/TenantOnboardingWizard.tsx:424`, `src/features/onboarding/OnboardingPage.tsx:169` (`WizardPanelsStepper`). Own: `src/features/assets/pages/ResourceTypeWizardPage.tsx:254`, `src/features/module-guide/ModuleGuide.tsx:215`, `src/features/assistant/ProductAssistantPage.tsx:34`.
- Error, shared: `src/features/admin/pages/AdminUsersPage.tsx:209`. Own: `src/features/assets/pages/AssetsPage.tsx:760,769`, `src/features/auth/LoginPage.tsx:358,395,485`.

Shared components nobody uses: `ui/advanced-card` (0), `ui/quick-edit-sheet` (0), `layout/ModuleIntroPage` (1).

## 2. Duplication hot spots

1,150 distinct class strings of 3+ classes; 910 (79%) are used exactly once.

| Visual role | Evidence |
|---|---|
| Section card / box | `rounded-* + border` on one element: 226 hits, 91 files, 16 features (only 45 add `bg-card`). Radius is mixed: `rounded-lg` 161, `rounded-xl` 98, `rounded-md` 44, `rounded` 31, `rounded-2xl` 11. Padding: `p-4` 96, `p-3` 70, `p-6` 21 |
| Page title | 4 variants: `text-2xl font-semibold tracking-tight` 15 hits, `text-xl ... sm:text-2xl` 8, `text-xl` 4, unstyled `<h1>` from CSS |
| Page container | `mx-auto` + `max-w-*` in 46 files, with 9 widths (`3xl` 23, `xl` 19, `md` 19, `7xl` 15, `2xl` 14, ...) |
| Error box | `rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive`: 11 identical copies in 8 files; 29 variants in 19 files |
| Toolbar / action row | `flex flex-wrap gap-2` 27 hits in 19 files; `flex flex-wrap items-center gap-2` 21 in 18; `flex items-center gap-2` 22 in 13 |
| Header row | `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`: 8 hits, 8 files (this is `PageHeader`) |
| Form field grid | `grid gap-3 sm:grid-cols-2` 19 hits in 13 files; `grid gap-4 sm:grid-cols-2` 5 |
| Filter bar | no shared component; `type="search"` or a search icon in 21 files |
| Footer actions | only `EntityPage` has a sticky bar (2 pages); 2 more hand-made fixed bars (`PortalCartPage.tsx:374`, `WorkOrderExecutionPage.tsx:1211`); other forms end with an inline button row |
| Pill / micro label | hand-made pills 18 hits in 10 files (`Badge` exists: 52 uses); uppercase micro-labels 37 hits in 15 files |
| Buttons | raw `<button>` 80 in 46 files vs `<Button>` 202 in 68. Touch height set three ways: `min-h-11` 170 hits, `touch-target` 53, fixed `h-8..h-12` 267. `min-h-11 w-full sm:w-auto` repeated 14 times |
| Colours | no hex in TSX (good). 98 raw palette classes (`emerald`, `amber`, `green`, `sky`) in 14 files although `--success`, `--warning`, `--info` tokens exist |
| Typography | 70 arbitrary sizes (`text-[11px]` 17, `text-[10px]` 13, `text-[0.65rem]` 11, 15 variants) in 12 files |
| Feature CSS | 19 feature `.css` files, about 2,200 lines, 211 `font-size` declarations, bypassing Tailwind and tokens |
| Breakpoints | Tailwind: `sm` 302, `md` 76, `lg` 59. Feature CSS uses `max-width` 767, 760, 640, 639 and 1023. JS detection (`useIsMobile`/`matchMedia`) in 7 files. Show/hide toggles in 10 files with 5 variants |

Side finding: `npm run tokens:check` reports "Generated tokens are stale" in this Windows worktree. Possibly a line-ending artefact; not investigated.

## 3. The standard

Rules for all archetypes:

- One layout switch: `md` (768px). Below it: single column, cards, full-width primary buttons, 44px touch targets. `sm` is only for 2-column field grids. No `max-width` media queries in new feature CSS.
- Colours, radius and shadows come from tokens only (`bg-card`, `border-border`, `text-success`, `rounded-xl` for surfaces, `rounded-md` for controls).
- A feature file composes shared components; it does not style a title, box, table, stepper or alert itself.

| Piece | Decision | API (props / slots) | Layout |
|---|---|---|---|
| `Page` (new, `layout/Page.tsx`, about 30 lines) | New thin wrapper around promoted `PageHeader` | `width: "wide" \| "form"` (max-w-7xl / max-w-3xl), `header: PageHeaderProps`, `state?: "loading" \| "error" \| "ready"`, `error?`, `onRetry?`, `children` | `space-y-6`; header stacks on mobile, actions wrap below title |
| `PageHeader` | Promote; add `eyebrow?` and `back?` | `title`, `description`, `icon`, `eyebrow`, `back`, `actions` | as today |
| `Section` | Promote `ui/card`; add a preset | `title`, `description`, `actions`, `children` | `rounded-xl border bg-card p-4 md:p-6` |
| `FilterBar` (new, `data-table/FilterBar.tsx`) | New | `search?: {value, onChange, placeholder}`, `filters` slot, `chips?: {label, onRemove}[]`, `actions` slot | Desktop: one row. Mobile: search full width, filters behind a "Filters" button that opens the existing `Sheet` |
| `DataList` (new, `data-table/DataList.tsx`) | New, on top of `ui/table` + TanStack | `columns`, `rows`, `getRowId`, `renderCard(row)`, `onRowClick?`, `toolbar` slot (`FilterBar`), `empty: EmptyStateProps`, `loading`, `error`, `onRetry`, `pagination?` | `md`+: table. Below: `renderCard` list. Empty, loading and error render inside the same frame |
| `FormPage` (extract from `EntityPage`) | Promote the save bar and unsaved guard | `header`, `dirty`, `saving`, `onSave`, `onDiscard`, `saveLabel`, `children` | `width="form"`; sticky footer; mobile footer is full width with primary on top |
| `FormSection` / `FormRow` | `FormSection` = `Section`; `FormRow` wraps `ui/form` `FormField` | `label`, `hint`, `required`, `error`, `span?: 1 \| 2` | `grid gap-4 sm:grid-cols-2`; label above control; error under control with `role="alert"` |
| `Wizard` | Promote `wizard/Wizard`; render `WizardPanelsStepper` inside it and retire its private stepper | existing props plus `stepperVariant` | Desktop: horizontal stepper. Mobile: "Step 2 of 4" with progress bar. Back left, Next right; on mobile Next is full width |
| Empty / Loading / Error | Promote `EmptyState`, `PageContentSkeleton`, `ErrorState`; inline errors use `ui/alert` `variant="destructive"` | existing | Always passed through `Page` or `DataList`, never hand-placed |

Delete or adopt after migration: `advanced-card`, `quick-edit-sheet`.

## 4. Migration plan

Guard mechanism: `scripts/lint-ratchet.mjs` already freezes per-file ESLint counts in `.eslint-baseline.json`. Each PR adds a `no-restricted-syntax` rule; existing violations are baselined, new ones fail CI, and the baseline only shrinks.

| # | PR | Files | Done when | Guard added |
|---|---|---|---|---|
| 1 | `feat(ui): add Page shell and pilot it on agenda` | new `layout/Page.tsx`; `PageHeader` (+`eyebrow`, `back`); `features/agenda/AgendasPage.tsx`, `agendas.css` | Agenda uses `Page` + `PageHeader`; no `<h1>` or `mx-auto` in the feature; tests green; gammera screenshots desktop + 375px | ban `<h1>` and `mx-auto max-w-*` outside `src/components` |
| 2 | `feat(ui): add DataList and FilterBar` + migrate reservations | new `data-table/DataList.tsx`, `FilterBar.tsx`; `rentals/components/ReservationsList.tsx`, `reservations.css` | Table on desktop, cards under 768px; table CSS removed; unit test for both layouts and the three states | ban raw `<table>` and `useReactTable` outside `components/data-table` |
| 3 | `refactor(users): people lists on DataList` | `PeopleUsersTab.tsx`, `PeopleCustomersTab.tsx`, `people-access.css` | No `people-table` CSS left | baseline shrinks |
| 4 | `refactor(assets\|admin\|catalog): tables on DataList` (3 PRs) | `AssetsPage.tsx`, `AdminAssetFamiliesPage.tsx`, `AdminUsersPage.tsx`, `CatalogProductsPage.tsx` | `useReactTable` only inside `DataList` | baseline reaches 0 for the table rule |
| 5 | `feat(ui): extract FormPage, FormSection, FormRow` | `EntityPage.tsx` (reuse), new `ui/form-layout.tsx`; pilots `pmoc/pages/CreatePlanPage.tsx`, `catalog/pages/CustomerGroupFormPage.tsx` | Sticky footer and unsaved guard on both; one label style | ban class string `grid gap-3 sm:grid-cols-2` and hand-made `<label className=...>` in features |
| 6 | `refactor(wizard): one Wizard, one stepper` | `wizard/Wizard.tsx`, `ui/wizard-panels.tsx`; `assets/pages/ResourceTypeWizardPage.tsx`, then `AssetWizard.tsx`, `TenantOnboardingWizard.tsx` (one PR each) | No `aria-current="step"` outside `src/components` | ban that attribute in features |
| 7 | `refactor(ui): states and alerts` | 19 files with red boxes; inline empty paragraphs | All errors via `ErrorState`/`Alert`, all empties via `EmptyState` | ban `border-destructive/30` literal in features |
| 8 | `refactor(ui): Section card adoption`, one feature per PR | start with dashboard, admin, workOrders | Feature has no `rounded-* border` literal | per-feature ban, widened each PR |
| 9 | `chore(ui): tokens and breakpoints` | 14 files with palette colours; 12 with arbitrary text sizes; feature CSS media queries | No palette colour classes; breakpoints only 640/768/1024 | ban `/(emerald\|amber\|green\|sky)-\d/` and `text-[` literals; stylelint-style grep for `max-width:` in feature CSS |

Order rationale: PR 1 is tiny and unblocks every other PR; lists (2 to 4) are the most visible inconsistency with the fewest files; forms and wizards touch validation and need more review; 8 and 9 are mechanical and can run in parallel.

Agenda as pilot: it fits PR 1 (page shell, header, filter card) and later `FilterBar` (`AgendaFilters.tsx`, 328 lines). Its day/week grid is a calendar, not a List, and stays custom.

## Decisions taken without the owner

- `md` (768px) is the single mobile switch, because the sidebar and most feature CSS already break near 767px.
- Promote existing components; only four new files (`Page`, `DataList`, `FilterBar`, `form-layout`).
- Customer portal and landing pages keep their own visual identity; they adopt states, buttons and tokens only (PRs 7 and 9).
- Counts come from grep over non-test `.tsx`; they are indicative, not exact to the unit.
