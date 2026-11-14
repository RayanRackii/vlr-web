# Agenda overview — recreate the owner's target mockup (2026-11-14)

Repositories: vlr-web only. Branch: `feat/agenda-target-layout`. Target image (visual only, its controls
have no logic): `docs/plans/active/assets/2026-11-14-agenda-target.png` — open it and match it.
Replaces PR B/C of `2026-11-14-agenda-redesign.md` (style C). Builds on PR A (#573: toolbar, chips,
filter panel, `recursos`/`livres`/`fechadas` URL params) and the shared `DateNavigator`/`StatusChips`.
Owner decisions: agenda content now, app shell (sidebar/top bar/banner) in a later PR — **do not change
the shell here**; resource/product filters move from the left panel into a popover opened from the
"N recursos selecionados" line (Sheet below `md`).
**Preserve** booking logic, filtering semantics, date navigation, URL state, permissions, the existing
create-reservation and block flows, loading/error/failedSources behaviour. A parallel PR moves data
fetching to TanStack Query inside `useAgendaDay.ts`/`useAgendaOptions.ts` — do not edit those two
files except for trivial type exports; work in the view layer and `dayGridModel.ts`.

## Layout (top to bottom, desktop)
1. Page header (existing `Page`/`PageHeader`): title "Visão geral das agendas", subtitle as in the mockup
   ("Todos os seus recursos. Uma visão do dia." — add pt-BR/en/es keys), actions right: secondary
   "Bloquear período" (icon ban/circle-slash), primary "Nova reserva" (icon plus). Same permissions
   as today. Keep the existing eyebrow until the shell PR.
2. Date row (outside the card): left "Hoje" button, then ‹ › icon buttons, then the date as
   "14 de novembro, 2026" (medium weight) followed by the weekday muted ("Sábado"); right: `Dia | Semana`
   segmented. Implement as a `layout="toolbar"` variant of the shared `DateNavigator` (default variant
   unchanged for Reservas); keep the date picker on the label.
3. One bordered card (`rounded-xl border bg-card`, no inner nested cards) containing:
   a. Tabs row: type filters as **underlined tabs** (Todos, Pedidos, Reservas, Manutenção, Bloqueios),
      each with a small count pill (muted; tinted on the active tab); active tab = primary text +
      2px underline. Same single-select `tipo` semantics/counts as today (adapt `StatusChips` with a
      `variant="tabs"` or a dedicated `FilterTabs` in `src/components/data-table/`). Search on the right
      of the same row: borderless input with search icon, placeholder "Buscar pedido ou cliente",
      same order-search behaviour as today.
   b. Info row (border-top): left a button "**N recursos selecionados**" (chevron) opening a Popover
      with the PR A filter content (resource tree with search + group checkboxes, Produto select,
      options, Limpar) — move `AgendaFilterPanel` content into it; remove the left panel, its collapse
      button and its localStorage key. Right, muted: "Horário comercial · 08:00 – 20:00" (min open –
      max close of the visible resources; "Horário variável" if none known).
   c. Grid header (border-top): first column "RECURSO" (uppercase, `text-xs`, muted, tracking) ~220px,
      then one label per hour (08:00, 09:00, …) left-aligned at each hour line.
   d. Rows (each ~68px, border-top): left cell = resource name (`text-sm` medium) + second line muted
      `text-xs` "Tipo · Categoria" (resource kind label, e.g. Equipamento/Espaço/Audiovisual, and
      category name; fall back gracefully). Timeline cell: vertical hour gridlines; the **current hour
      column** has a subtle tint when the date is today. Blocks: `bg-primary/8`, 3px left border in the
      kind colour, `rounded-md`, padding ~8px 10px, line 1 title (`text-xs` medium, kind colour), line 2
      `text-[11px]`-equivalent token size muted "HH:MM – HH:MM · Produto/descrição" (use existing type
      scale, no arbitrary px). A block covering the whole visible window shows "Dia inteiro · …" as line 2.
      Overlapping blocks in a row stack in lanes (row grows); never render a block outside its row.
      Empty row: muted "Disponível para reserva" at the start; clicking an empty slot (or that text)
      opens today's create-reservation flow prefilled with resource + slot time when permitted
      (else no action); keep "Bloquear período" reachable from a row hover menu (kebab) or the header.
   e. Footer (border-top, `text-xs` muted): left "N recursos · M atividades neste dia"; right legend
      dots for kinds present ("Pedidos", "Reservas", …) and "Atualizado agora"/"Atualizado há X min"
      (time since last successful load).
4. Kind colours (one map, tokens): pedido = primary (blue, as mockup), reserva = info, manutenção =
   success/teal, bloqueio = muted gray (diagonal stripes ok), atrasado = destructive border. Define once
   (e.g. `agendaKindTone`) and reuse in blocks, legend and tabs.

## Axis rule (fixes the current 00:00–23:00 bug)
- Default axis = business hours of the visible resources (min open → max close, rounded to the hour).
  Do **not** widen the axis because a block is long or spans days; clip such blocks to the axis and
  mark them ("Dia inteiro" when they cover it, a small "continua" chevron at a clipped edge).
- The PR A option "Mostrar horas fechadas" becomes "Mostrar 24 horas" (URL `fechadas=1` = full day,
  default off). Update urlState and its tests accordingly.

## Week view
Same card chrome (tabs, info row, footer). Grid: resource column + 7 day columns; each cell shows the
day's blocks count by kind as small tinted pills (or "Livre"), clicking a cell opens that day. Today's
column tinted.

## Mobile (< md)
Date row wraps (Hoje + chevrons + date on one line, Dia/Semana below). Tabs row scrolls horizontally;
search collapses to an icon that expands. Rows become cards: resource name + meta, then the day's blocks
as a list (time + title), or "Disponível para reserva". Filters popover becomes a bottom `Sheet`.
No horizontal page overflow at 375px.

## Tests (vitest; write first)
axis = business hours and not widened by a long block; block clipped + "Dia inteiro"; overlapping lanes;
tabs counts and selection; popover opens with the resource tree and filters still update the URL;
"Horário comercial" text; footer counts; empty-slot click calls the create flow with resource+time;
current-hour tint only on today; week cells; mobile card layout renders (matchMedia mocked); existing
agenda tests updated, assertions preserved.

## Checks
`npx vitest run src/features/agenda src/components --testTimeout=60000`, `npm run lint:ratchet`,
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`. Tokens only, 44px targets on interactive
controls, no new feature CSS for layout beyond what grid geometry needs (CSS variables for hour width ok).

## Done when
Checks pass; screenshots are taken by the session on DEV after merge; commit
`feat(agenda): recreate the target layout for the overview` (body + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`),
push, open the PR with `gh pr create` (body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Do not merge.
