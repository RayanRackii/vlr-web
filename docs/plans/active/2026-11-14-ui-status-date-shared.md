# Shared status tones, StatusChips, DateNavigator (2026-11-14)

Repositories: vlr-web only. Branch: `feat/ui-status-date-shared`. Context: the owner pointed out that
Agenda, Pedidos and Reservas each render header, date control and status chips differently. Agreed
order: (1) these shared pieces, piloted on Reservas; (2) Agenda redesign
(`docs/plans/active/2026-11-14-agenda-redesign.md`, separate branch); (3) Pedidos; (4) Reservas header.
Rolvix is generic: no tenant- or resource-type-specific names in shared code.

## 1. One status tone map — `src/components/ui/status.tsx` (new)
- `export type StatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger"`.
- One table mapping each tone to token-based classes for: badge (bg/text/border), dot (bg), chip
  active border. Use existing theme tokens/CSS variables (`text-success`, `bg-success/10`, etc. — read
  `src/styles` and `ui/badge.tsx` variants; map onto existing Badge variants where they fit). No raw
  hex, no palette classes (`emerald-…`), dark mode works.
- Components: `StatusDot({ tone })` (8px, `aria-hidden`), `StatusBadge({ tone, children })`
  (pill, `text-xs`, dot + label).
- Meaning (document in the file): neutral = draft/cancelled-like/inactive, info = scheduled/confirmed,
  progress = in production/in progress, warning = waiting for someone (approval, deposit), success =
  done/completed, danger = failed/overdue/rejected.
- Domain mapping stays in features (e.g. `rentals` maps `PendingDeposit→warning, Confirmed→info,
  Completed→success, Canceled→neutral`), importing only the tone type.

## 2. `StatusChips` — `src/components/data-table/StatusChips.tsx` (new)
Props: `{ label: string; allLabel: string; value: T | null; onChange: (v: T | null) => void;
options: readonly { value: T; label: string; tone?: StatusTone; count?: number }[]; allCount?: number }`.
- Renders a `role="group"` with **"Todos/allLabel" always first**, then options in the given order;
  single-select (`aria-pressed`), active chip uses the accent style; each chip shows its `StatusDot`
  (if `tone`) and its count (if given, muted, `tabular-nums`); 44px touch targets; wraps on small
  screens; tokens only. Intended for the `FilterBar` `filters` slot.

## 3. `DateNavigator` — `src/components/ui/date-navigator.tsx` (new)
Props: `{ date: string /* civil yyyy-MM-dd */; onDateChange: (d: string) => void;
view: V; views: readonly { value: V; label: string }[]; onViewChange: (v: V) => void;
step: (date: string, view: V, direction: -1 | 1) => string; today: string;
label: string /* formatted date or range, provided by the caller */; labels: { previous: string; next: string; today: string; view: string } }`.
- Layout, always in this order: view `SegmentedControl` (existing component) → "‹" icon button →
  the date label (aria-live="polite", min width so it doesn't jump) → "›" icon button → "Hoje" button
  (disabled-looking but enabled when already today is fine; keep it enabled). Wraps on < `md`
  (views on their own row). 44px targets, lucide icons via `ICON_SIZE`/`ICON_STROKE_WIDTH`.
- Optional native date input behind the label (click label → `<input type="date">` popover or the
  existing `LocaleDateInput`) only if trivial with existing components; otherwise skip and say so.
- Generic: no knowledge of reservations/agenda; the caller supplies `step` and `label`.

## 4. Pilot on Reservas (`src/features/rentals/pages/ReservationsPage.tsx` + `components/ReservationsList.tsx`)
- Replace today's view switch + date picker + "Hoje" with `DateNavigator` (views Dia/Semana/Mês, same
  behaviour and URL/state as today).
- Replace the status chips with `StatusChips` (Todos first, counts from the loaded rows per status,
  tones via a `reservationStatusTone` map in the rentals feature).
- `ReservationsList` status badge → `StatusBadge` with the same map (remove `statusVariant` and the
  `reservation-status-dot`/`reservation-filter-dot` CSS if now unused; grep src and e2e).
- Same filtering semantics, texts, empty-state behaviour.

## 5. Tabs rule (document only, adoption in later PRs)
Add to `docs/plans/active/2026-11-13-ui-standard-patterns.md` a short "Page tabs" section (create the
section in this branch's copy of that file only if the file exists on develop; otherwise put it in
this spec): page-level tabs use `FeatureRouteTabs` (line variant, text only, no icons).

## Tests (vitest; write first)
- `status.tsx`: each tone renders a badge with label and a dot; no raw palette classes.
- `StatusChips`: Todos first and pressed when value=null; counts shown; selecting calls onChange;
  clicking Todos clears; tones render dots.
- `DateNavigator`: order of controls; prev/next call `step` with −1/+1; Hoje calls onDateChange(today);
  view change; aria-live label.
- Reservas: existing tests stay green (update selectors only); chips show counts; date navigation
  still moves day/week/month.

## Checks
`npx vitest run src/components src/features/rentals --testTimeout=60000`, `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Local `tokens:check` CRLF failure is known.

## Done when
Checks pass; commit `feat(ui): add status tones, StatusChips and DateNavigator, piloted on reservations`
(body + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, open the PR to `develop`
with `gh pr create` (body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
Do not merge.

## Page tabs (rule, recorded here because `2026-11-13-ui-standard-patterns.md` is not on develop)
Page-level tabs use `FeatureRouteTabs` (line variant, text only, no icons). Adoption in later PRs.

## Implementation notes
- `DateNavigator`: the optional native date picker was skipped (not trivial with `LocaleDateInput`, which
  renders its own formatted field). Jumping to an arbitrary date on Reservas is now prev/next/Hoje only.
- Reservas status counts come from the loaded rows, which are filtered server-side, so counts show only
  while "Todos" is selected.
