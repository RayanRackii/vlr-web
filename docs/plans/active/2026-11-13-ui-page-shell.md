# PR 1 — Page shell, piloted on the agenda (2026-11-13)

Repositories: vlr-web only. Branch: `feat/ui-page-shell`. Source plan: vlr-web#562
(`docs/plans/active/2026-11-13-ui-standard-patterns.md`, PR 1 of 9). The owner approved starting PR 1.

## Goal
One shared page frame so feature screens stop hand-writing titles and page widths. Pilot it on
Agendas (`src/features/agenda/AgendasPage.tsx`) with no visible change except the header now
comes from the shared component. The day/week calendar grid, filters and date navigation stay as
they are.

## Changes
1. `src/components/layout/PageHeader.tsx` — add two optional props, existing users unaffected:
   - `eyebrow?: ReactNode`: small line above the title, `text-[13px]`-free: use
     `text-sm font-semibold tracking-wide text-primary` (token colour, no raw px).
   - `back?: { to: string; label: string }`: a `react-router-dom` `Link` above the title with a
     lucide `ChevronLeft` (size via `ICON_SIZE`/`ICON_STROKE_WIDTH` from `@/lib/icon`), min touch
     height 44px (`min-h-11`), `text-sm text-muted-foreground hover:text-foreground`.
   Keep the single `<h1>`.
2. `src/components/layout/Page.tsx` (new, small):
   ```ts
   type PageProps = {
     header: PageHeaderProps
     width?: "wide" | "form"          // wide = w-full max-w-7xl, form = w-full max-w-3xl; default "wide"
     state?: "ready" | "loading" | "error" // default "ready"
     error?: ReactNode                // message for ErrorState
     onRetry?: () => void
     className?: string
     children: ReactNode
   }
   ```
   Renders `<div className={cn("mx-auto min-w-0 space-y-5", widthClass, className)}>` →
   `<PageHeader {...header} className={cn("mb-0 sm:mb-0", header.className)} />` → body:
   `loading` → `PageContentSkeleton` (`@/components/loading/PageContentSkeleton`); `error` →
   `ErrorState` (`@/components/ErrorState`, pass `message`/`onRetry` per its props); else `children`.
   Export from wherever layout components are exported (follow the existing pattern).
3. `src/features/agenda/AgendasPage.tsx` — replace the outer `<div className="agendas-page …">` +
   hand-made `<header>` with
   `<Page className={\`agendas-page agendas-${view}\`} header={{ eyebrow: t("agendas.eyebrow"), title: t(\`agendas.${view}.title\`), description: t(\`agendas.${view}.subtitle\`) }}>`.
   Keep `agendas-page` / `agendas-${view}` classes (the CSS and the shell override depend on them).
   Everything below the header unchanged.
4. `src/features/agenda/agendas.css` — delete the now-unused `.agendas-eyebrow` rule. Keep the
   shell override on line 2 and the width rule on line 3 unless visual parity holds without them;
   do not change anything else.
5. Guard — `eslint.config.js`: for `src/features/**/*.{ts,tsx}` excluding tests, add
   `no-restricted-syntax` entries (merge with any existing `no-restricted-syntax` config for those
   files, do not replace it):
   - `JSXOpeningElement[name.name='h1']` — message: "Use PageHeader/Page from
     @/components/layout for the page title (docs/plans/active/2026-11-13-ui-standard-patterns.md)."
   - a `className` string literal containing both `mx-auto` and `max-w-` — message: "Use
     Page width instead of hand-set page widths." (selector on `JSXAttribute[name.name='className']`
     with a `Literal` value regex; also cover simple template literals if easy, otherwise literal only).
   Record existing violations in `.eslint-baseline.json` with the repo's ratchet flow
   (`scripts/lint-ratchet.mjs`; read it for the baseline update option). The agenda files must
   end with 0 violations of the new rules. The baseline may only gain entries for the new rules.

## Tests (vitest; write first)
- `src/components/layout/Page.test.tsx`: renders exactly one `h1` with the title, eyebrow and
  description; `state="loading"` shows the skeleton and not the children; `state="error"` shows
  the error and calls `onRetry` on the retry button; `width="form"` applies `max-w-3xl`.
- `PageHeader` test (new or existing file): `back` renders a link to `to` with the label.
- Existing `src/features/agenda/*.test.tsx` stay green (title/eyebrow text still present).

## Checks (quiet, see AGENTS.md)
`npx vitest run src/components/layout src/features/agenda`, `npm run lint:ratchet`,
`npm run tokens:check`, `npm run build`. Report failures you could not fix.

## Out of scope
Other features, the filter bar, DataList, any API change, any visual redesign of the agenda.

## Done when
Checks pass; commit `feat(ui): add Page shell and pilot it on agenda` (body + the line
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, PR to `develop` linking this spec
and vlr-web#562, body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
Do not merge. Visual check on DEV is done by the session after merge.
