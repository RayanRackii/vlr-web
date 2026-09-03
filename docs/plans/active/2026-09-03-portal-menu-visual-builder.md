# Portal menu visual builder (WEB-only)

Repositories: `vlr-web`
Branch: `feat/portal-menu-visual-builder`
Date: 2026-09-03

## Audit (no API change)

**MENU_CONTRACT:** `ModuleMenuItem` = `{ id, moduleName, label, sortOrder, isActive, rentalAssetId?, assetId? }`.  
Create/Update/Delete: `/api/module-menu-items` and admin `/api/admin/tenants/{id}/module-menu-items`.  
Public B2C: `GET /api/public/tenants/{subdomain}/menu` returns **active items whose module is active**, ordered by `sortOrder`.

**B2C_RENDER_SOURCE:** `buildCustomerNavItems` (`src/features/catalog/customerNav.ts`) + `iconForModule` (`CustomerSidebar`).  
- `rentals` → one nav item, **configured label**, path `agenda/{menuItemId}`  
- `catalog` (aliases) → **two** items with **fixed i18n** labels (Catálogo / Meus pedidos); configured label is **not** shown  
- other modules → **not rendered** in B2C nav today  

**ORDER_PERSISTED:** YES (`sortOrder`). Reorder via existing PUT (no new field).  
**ICON_PERSISTED:** NO. Derive `iconForModule` only. No icon picker. `ICON_CONFIGURATION_FOLLOWUP`.  
**VISIBILITY_PERSISTED:** YES (`isActive`). Public menu already filters inactive.  
**API_CHANGE_REQUIRED:** NO.

## Shared logic (mandatory)

Add/keep in `customerNav.ts` (or a sibling `portalMenuVisibility.ts` imported by B2C + builder):

- `getVisiblePortalMenuItems(items, activeModules)` — same rules as public API (`isActive` + module in tenant active set)
- `buildCustomerNavItems` — unchanged semantics; preview **must** call this
- `iconForModule` — reuse

Do **not** invent a second catalog/rentals mapping.

Preview nav uses **buttons**, not `NavLink` / real routes.

## UX

Page `/configuracoes/menu`: shell like cadastro/pessoas (`max-w-7xl`, centered H1). Copy:

- Title: Menu do portal  
- Subtitle: Organize os atalhos e páginas que seus clientes verão após entrar no portal.

Two columns lg+: Config | Prévia. Stack below lg. Optional Desktop/Mobile preview toggle (simple, no device chrome).

Config list: compact rows (icon from `iconForModule`, label, friendly module + destination, Ativo/Oculto / Módulo inativo / Não aparece no portal). Grip or up/down to persist `sortOrder`. `+ Adicionar item` → Dialog. Edit/delete (confirm). Empty: PeopleEmptyState pattern + CTA.

Editor fields: Funcionalidade (canonical `rentals` | `catalog` for **new** items — only what B2C nav understands; keep listing legacy inventory/pmoc/os rows). Destino (rentals: agenda geral vs asset). Nome exibido. Ativo. Suggest label once when functionality/destination changes; never overwrite after user edits label (`labelTouched`).

Preview: TenantLogoMark + name when branding available (`subdomain` prop / fetchTenantBranding). Tenant B2B without subdomain: fallback display name, still apply `useTenantThemeCssVars` if colors unknown. Mock content only. Click preview item sets active preview id only.

`ModuleMenuItemsManager` stays embeddable in Super-Admin `TenantEditForm` (has subdomain).

## Presets

Do not implement. `PRESETS_FUTURE_SAFE: YES` (sequential existing creates).

## Tests

Manager + preview + `getVisiblePortalMenuItems` / `buildCustomerNavItems` catalog split. Preview click does not use router navigate.
