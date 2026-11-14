# Agenda overview redesign — style C (2026-11-14)

Repositories: vlr-web only (no API change expected; if one turns out to be needed, stop and report).
Screen: Agendas → Visão geral (`/agendas`, also `/agendas/recursos` and `/agendas/produto` views)
in `src/features/agenda/`. Owner chose "style C" from three mockups and approved the final layout:
"Todos" first among type chips; Recurso and Produto filters in a collapsible left filter panel.
Data for DEV checks: `npm run seed:agenda:dev` (tenant zzr14locacao: Impressora 3D Alfa/Beta,
Cortadora Laser Gama, 08–22, 5 orders/day for 13–26 Nov 2026).

Delivered in three PRs (same branch prefix `feat/agenda-…`, one PR each, in order):

## PR A — toolbar, type chips, filter panel  (branch `feat/agenda-toolbar-filters`)
1. Page frame: keep `Page` (from #563); the agenda uses the full content width (calendar), so give
   `Page` a `width="full"` option (`w-full`, no max width) and use it here; drop the 1240px rule in
   `agendas.css` if it becomes redundant. Header actions: "Nova reserva" (primary, only with
   `rentals.reservations.read`/write as today's "Criar reserva" links) and "Bloquear período"
   (secondary, same permission as today's block link) — they open today's existing flows.
2. Row 1 (date bar): use the shared `DateNavigator` (`src/components/ui/date-navigator.tsx`, from
   PR `feat/ui-status-date-shared` — rebase on develop after it merges) with views Dia | Semana.
3. Row 2 (type chips + search): the shared `StatusChips` (`src/components/data-table/StatusChips.tsx`)
   without tones (agenda kinds are not statuses; their colours live in the blocks/legend), options in
   this order after **Todos**: Pedidos, Reservas, Manutenção,
   Bloqueios, each with the count of blocks of that type in the loaded range (Todos = total); plus an
   "Atrasados N" chip (danger style, hidden when 0) — counting blocks PR B marks overdue (in PR A
   leave the chip out if the overdue rule is not available yet). Single-select like today's `tipo`.
   Search "Pedido ou cliente" on the right of the same row (existing order search behaviour).
4. Filter panel (left of the grid on `lg`+, collapsible to an icon rail; on < `lg` it opens as the
   existing `Sheet` from a "Filtros" button in row 2):
   - "Recursos · X de Y": a search box + checkbox tree grouped by resource category
     (`AgendaRow.categoryName`, "Sem categoria" fallback). Group checkbox toggles its resources
     (indeterminate when partial). URL state: new `recursos` param (comma-separated ids); keep reading
     the old single `recurso` param for backwards compatibility (map to `recursos=[id]`).
   - "Produto": a select with "Todos os produtos" + catalog products (today's produto filter;
     same URL param `produto`). The `/agendas/produto` view still requires a product.
   - Options: "Só recursos com horário livre" (hide rows with no free time in range) and
     "Mostrar horas fechadas" (default on; consumed by PR B, store in URL `fechadas=0` when off).
   - "Limpar filtros" resets recursos/produto/tipo/search/options.
   - Panel collapsed state remembered per viewer in localStorage (try/catch; default open on `lg`+).
5. Remove the old Recurso/Produto pick filters from `AgendaFilters.tsx` (keep its order search).
6. Tests (vitest): chip order and counts; selecting a chip filters; resource tree group toggle and
   indeterminate; `recursos` URL round-trip incl. legacy `recurso`; product select; clear; panel
   collapse persisted; Sheet on small screens (render with the trigger, assert it opens).
7. Guards: no new feature CSS for layout; tokens only; 44px targets; `.eslint-baseline.json` unchanged.

## PR B — day timeline + details panel  (branch `feat/agenda-day-timeline`)
1. Axis from the earliest open to the latest close among visible resources (existing
   `buildAgendaDay` start/end), hour labels every 2h, hour gridlines, "now" line with time label when
   the date is today. Closed hours per resource hatched (unless `fechadas=0`, then trimmed).
2. Rows grouped by category with collapsible group headers ("Impressoras 3D · 3 recursos · 46%");
   fixed compact row height (40px); left cell: name + "NN% ocupado · 08–22h" (occupancy = booked
   minutes of non-block types / open minutes), "Livre" when 0, "Preso por atraso" when overdue.
3. Blocks: colour by type via tokens (pedido purple, reserva blue, manutenção teal, bloqueio gray,
   atrasado coral — define them once as agenda tokens/classes, not per component), text
   "HH:MM–HH:MM · label"; selected block outlined.
4. Overdue: a production block (pedido) whose end is before now and whose order is not finished
   (use `orderStatus`; finished = Completed/Ready/Cancelled/Rejected — confirm values in
   `catalogService` types) is "atrasado": draw the planned window in coral with a warning icon and a
   hatched continuation to the end of the visible day; never stretch the axis to 00–23 because of it.
5. Empty row: dashed "Livre o dia todo · clique para reservar". Clicking an empty time cell selects a
   half-hour slot.
6. Details panel (right side on `lg`+, bottom `Sheet` below): for a block — type, status badge,
   resource, time and duration, product, customer, actions (Abrir pedido/reserva, Remarcar when today's
   flows allow, "Concluir e liberar" for overdue only if an existing endpoint/flow exists — otherwise
   link to the order); for a free slot — "Reservar a partir de HH:MM" and "Bloquear" opening today's
   flows prefilled with resource and time.
7. Replace `AgendaDayGrid.tsx` internals; keep its loading/error/failedSources behaviour.
8. Tests: axis bounds; group collapse; occupancy %; overdue detection and rendering; slot click;
   panel content and actions; failed-source warnings still shown.

## PR C — summary, week view, mobile  (branch `feat/agenda-summary-week-mobile`)
1. Summary strip above the grid: Ocupação do dia, Atividades, Em andamento, Atrasados (metric tiles,
   tokens).
2. Week view: resource × day grid, each cell shows the day's occupancy % with a tinted background
   (4 steps) or "atraso"/"livre"; click opens that day in Dia.
3. Mobile (< `md`): Dia renders one card per resource (name, occupancy, mini day bar with the now
   marker, list of items "HH:MM label"), "Livre · toque para reservar" when empty.
4. Tests for each.

## Checks (each PR)
`npx vitest run src/features/agenda src/components --testTimeout=60000`, `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Local `tokens:check` CRLF failure is known.

## Done when (each PR)
Checks pass; commit (Conventional Commits, scope `agenda`, body + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`),
push, open the PR to `develop` with `gh pr create` (body: what, behaviour changes, checks, link to this
spec; ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Do not merge.
