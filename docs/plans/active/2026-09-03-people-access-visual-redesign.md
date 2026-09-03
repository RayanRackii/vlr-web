# Pessoas e acesso — visual redesign (WEB-only)

Repositories: `vlr-web`
Branch: `feat/people-access-visual-redesign`
Date: 2026-09-03

## Goal

Make `/pessoas-e-acesso` visually consistent with Escala / agenda (`/configuracoes/agenda`) without changing RBAC, invite API, or support-mode behavior.

## Reference

`src/features/rentals/pages/SchedulePage.tsx` header + underline tabs.
`src/features/rentals/components/schedule/OccupancyKindsTab.tsx` section header + primary `Button size="sm"` + list rows.
`src/features/rentals/components/schedule/ScheduleEmptyState.tsx` empty visual (icon circle, dashed border, title + description).

Do **not** import `ScheduleEmptyState` from rentals (feature coupling). Replicate the same class pattern in the users feature.

## Layout

- Centered column: `mx-auto w-full max-w-6xl space-y-6` (narrower than agenda’s 1600px grid; AppShell already pads `p-4 md:p-6` — do not double-pad like agenda unless needed).
- Centered title + subtitle (`max-w-xl mx-auto text-center`), same type scale as agenda (`text-2xl font-semibold` / `text-sm text-muted-foreground`).
- Underline tabs (not `TabsList` default muted box): `border-b` + `border-b-2` active `border-primary text-primary`, inactive `text-muted-foreground`. Tabs: Usuários / Funções e permissões. Preserve `useState` tab + `can("core.roles.read")` hiding roles tab.
- Invite: existing `Button` primitive, `size="sm"` like occupancy kinds create. No new button component. No hardcoded colors.
- Empty users: icon + `peopleAccess.users.empty` + new `peopleAccess.users.emptyDescription`. Invite stays in the section header (do not require a second CTA in empty).
- Populated users: keep list rows (name, email, roles, status badge, assign). Clean table/list, not large cards.
- Roles tab: same shell; do not change permission editor rules.
- Do not change `MainLayout` support banner.

## i18n

Update `pt-BR`, `en`, `es`. No hardcoded user-visible strings.

## Out of scope

API, invite DTO, auth, tenant isolation, PROD, global shell/sidebar.
