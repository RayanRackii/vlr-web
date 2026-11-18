# Staff app shell — recreate the owner's target mockup (2026-11-14)

Repositories: vlr-web only. Branch: `feat/shell-target-layout` from up-to-date `origin/develop`.
Target image (visual only — its controls have no logic): `docs/plans/active/assets/2026-11-14-agenda-target.png`.
Follows `2026-11-14-agenda-target-layout.md` (agenda content, merged). This PR = the **staff shell** for every
screen: sidebar, top bar, super-admin banner. Commit this spec as
`docs/plans/active/2026-11-14-shell-target-layout.md` in the same PR.

**Preserve:** navigation structure, permission/module filtering (`useAppNavigationSections`,
`filterNavigationItemsByAccess`), module intros, collapse state + its localStorage key, mobile Sheet menu,
sign-out flow, platform-admin enter/exit flow (`handleExitEnvironment` in `MainLayout.tsx`), TrialBanner,
StaffHomeRedirectNotice, NotificationBell, LanguageSwitcher, theme switching, BreadcrumbTitle context.
**Portal variant (`variant="portal"`) must render exactly as today.** Brand stays **Rolvix** (`app.name`);
"RoMix" in the mockup is a placeholder. Tokens only, no arbitrary colours; 44px targets on mobile.

## Files
`src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `Breadcrumb.tsx`, `MainLayout.tsx`, `PageHeader.tsx`,
new `src/components/layout/SidebarAccount.tsx` (user card + menu) and `src/components/layout/ShellContext.ts`
(or similar), locales pt-BR/en/es `common.json`, the matching tests.

## 1. Sidebar (staff, desktop `lg+` and the mobile Sheet)
Width `w-56` expanded (collapsed width unchanged). Top to bottom:
1. **Brand row** (h-16): square `size-8 rounded-lg bg-primary text-primary-foreground` mark with the first
   letter of `app.name`, then `app.name` (`text-base font-semibold`). Collapse toggle stays at the right
   (ghost icon). Collapsed: mark only, toggle below/beside as today.
2. **Tenant card** (`mx-3 rounded-lg bg-sidebar-accent px-3 py-2.5`, display only — no switcher logic):
   line 1 `text-sm font-medium` truncate = tenant name (`staffHeaderContextLabel(currentUser, …)`; when a
   platform admin is inside a tenant use `activeTenantLabel` if the user payload has no name); line 2
   `text-xs text-muted-foreground` = new key `nav.workspaceCaption` ("Seu espaço de trabalho" / "Your
   workspace" / "Tu espacio de trabajo"). Platform admin on `/admin*`: line 1 `nav.platformWorkspace`
   ("Plataforma Rolvix"), same caption. Collapsed: a `size-9` rounded square with the tenant initial,
   `title` = tenant name. Pass the data from `MainLayout` through the sidebar render options (AppShell
   `sidebar(opts)` stays the API; add props on `Sidebar`, not in AppShell).
3. **Nav**: no separators between sections. Section titles = plain labels `px-3 text-xs font-medium
   uppercase tracking-wide text-muted-foreground` (keep the existing expand/collapse behaviour where a
   section has it, but render the toggle as a quiet chevron after the label). Standalone overview item
   ("Início") has no label above it. Rows: icon `size-4.5`/`size-5` + `text-sm`, rest `text-muted-foreground`
   → hover `bg-sidebar-accent`; **active row = `bg-primary/10 text-primary font-medium` rounded-lg, remove the
   left `ActiveIndicator` pill**. Children (e.g. Agendas → Visão geral / Agenda de recursos / Agenda do
   produto) indented to the parent's text start, no icons, same active treatment.
4. **Bottom area** (pinned, `mt-auto`, border-top `border-sidebar-border`):
   a. The **settings section** (`nav.sections.settings`) moves here, rendered as a single row "Configurações"
      (gear icon) that expands its items upward/inline (same items, same permissions; collapsed rail = gear
      icon with the existing collapsed-section behaviour). If the active section set has no settings
      section, nothing renders.
   b. No "Ajuda e suporte": there is no help route today (visual only) — leave it out and say so in the PR.
   c. **User card** (`SidebarAccount`): `Avatar` with initials, name `text-sm font-medium` truncate, second
      line `text-xs text-muted-foreground` = role label (existing translation for `currentUser.role` if one
      exists, else the first tenant role name, else nothing). The whole card is the account
      `DropdownMenu` trigger (`side="top"`, `aria-label={t("account.openMenu")}`): header with name/email,
      Perfil (`profileTo`), theme items (Claro / Escuro / Sistema via `useTheme` from next-themes — reuse
      the labels ThemeToggle uses or add keys), separator, Sair (destructive, same `onSignOut` +
      signing-out state). Collapsed: avatar only.

## 2. Top bar (staff)
`h-16`, `px-4 lg:px-8`, border-bottom, same sticky/blur. Left: on `lg+` the **breadcrumb** (move the
`<Breadcrumb />` render out of the page content in `MainLayout` into the top bar via a new AppShell prop,
e.g. `headerStart`), styled `text-sm`: ancestors `text-muted-foreground` links, current page
`text-foreground font-medium`, `/` separators (muted) instead of chevrons. Below `lg`: menu button + page
title as today (Breadcrumb's narrow back-arrow mode may render under the title as today — keep the
current behaviour on mobile, just in the header). When Breadcrumb returns null, show `pageTitle`.
Remove the tenant `contextLabel` from the staff header (it lives in the tenant card now).
Right: LanguageSwitcher with the short code (`PT`), NotificationBell; **no ThemeToggle and no avatar on
`lg+`** (both live in the sidebar user card). Below `lg` keep an avatar button opening the same account menu
(the Sheet sidebar also shows the user card). No global search icon (no search feature exists).

## 3. Super-admin banner (slim, one line on every width)
Replace both banners in `MainLayout` (in-tenant amber box and `/admin` platform box) with one slim bar:
`flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 lg:px-8 py-1.5 text-xs
text-muted-foreground`. Left text truncates (`min-w-0 truncate`): in tenant = new key
`admin.support.bannerSlim` ("Você está visualizando este espaço como super-admin" / en / es); on `/admin` =
existing `admin.support.platformPanel`. Right (in tenant only): text button `text-xs font-medium
text-primary hover:underline` with new key `admin.support.exitShort` ("Sair do tenant"), disabled + 
`admin.support.exiting` while exiting, same `handleExitEnvironment`; give it a 44px hit area on touch
(`touch-target` utility or padding) without growing the bar visually. Target height ≤ 36px at 375px.

## 4. Page eyebrow
The top-bar breadcrumb replaces the eyebrow. Add a small context (`ShellContext` with
`{ breadcrumbInHeader: boolean }`, provided by the staff AppShell) and make `PageHeader` skip the eyebrow
when it is true. Portal pages keep eyebrows. Do not edit the 27 call sites (W2 removes the prop later).

## Tests (vitest; write first, `renderWithQuery`/existing helpers)
- Sidebar: tenant card shows the trade name and caption; platform `/admin` shows the platform label;
  active row has the tinted class and no indicator pill; settings section renders in the bottom area;
  sections still filtered by permissions (existing tests keep passing).
- SidebarAccount: opens the menu, Perfil link, theme item calls `setTheme`, Sair calls `onSignOut` once.
- AppShell/MainLayout: breadcrumb renders inside `data-shell-part="header"` and not inside `main`;
  portal variant unchanged (snapshot of parts or explicit assertions); header has no ThemeToggle on staff.
- Banner: in-tenant slim bar shows `bannerSlim` + exit button that calls the exit flow; `/admin` shows
  the platform text without the button.
- PageHeader: eyebrow hidden under the staff shell context, visible without it.
- Update existing layout tests; keep their assertions unless the element moved (then assert the new spot).
- `grep -rn "account.openMenu\|Sair do ambiente\|admin.support.exit" e2e/` and update Playwright selectors
  that this changes (keep aria-labels stable where possible).

## Checks
`npx vitest run --testTimeout=60000`, `npm run lint:ratchet` (baseline may not grow),
`npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, `npm run tokens:check`.

## Done when
Checks pass; commit `feat(shell): recreate the target sidebar, top bar and slim banner`
(body + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), push, open the PR to `develop` with
`gh pr create` (body ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`), listing
what was intentionally left out (help link, search icon). Do not merge. Screenshots are taken by the
orchestrating session on DEV after merge.
