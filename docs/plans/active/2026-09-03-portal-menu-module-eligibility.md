# Portal menu — module eligibility + discovery (WEB-only)

Repositories: `vlr-web`
Branch: `feat/portal-menu-module-eligibility`
Date: 2026-09-03

## Audit

**MODULE_STATE_SOURCE:** `GET /api/users/me` → `currentUser.activeModules` via `usePermissions()`. Super-Admin embed passes `TenantEditForm` `activeModules` (Pascal `MODULE_KEYS` mapped with `toCanonicalModuleName`).
**ACTIVE_MODULE_SOURCE:** same (`activeModules` on current user / tenant edit form). Backend create/update: `ModuleMenuItemService.EnsureModuleActiveAsync` (`core.tenant_modules` + `IsActive`) → `Module '{name}' is not active for this tenant.`
**AVAILABLE_MODULE_SOURCE:** product catalog `MODULE_KEYS` in `adminTenantSchemas.ts` (`Inventory`, `PMOC`, `OS`, `Rentals`, `Catalog`). No B2B self-serve activation API.
**API_CHANGE_REQUIRED:** NO
**MIGRATION_REQUIRED:** NO

B2C-supported functionalities (must match `isCustomerNavModule`): `rentals`, `catalog` only.

## Behavior

1. Add-item **Funcionalidade** lists only modules that are **B2C-supported AND active** for the tenant.
2. Block submit if the selected module is not eligible (defense in depth).
3. Persisted items for inactive modules stay in the admin list with existing badges; preview still uses `getVisiblePortalMenuItems` → `buildCustomerNavItems`.
4. If no eligible module to add: no empty `<select>`; copy `Nenhuma outra funcionalidade ativa disponível.`; hide Add CTA; discovery section remains.
5. Discovery section **Amplie seu portal** lists B2C-supported modules that are **inactive**. Cards must not enter preview/B2C nav.
6. **MODULE_ACQUISITION_FLOW_AVAILABLE:** NO for tenant B2B (`/configuracoes/menu`). Super-Admin tenant edit: CTA `Conhecer módulo` scrolls to `#tenant-modules` on the same page (existing module checkboxes). Do not invent purchase/pricing.
7. Catalog editor: no editable customer `Nome exibido`. Read-only explanation of automatic Catálogo + Meus pedidos. Persist existing/suggested `label` for the API. Rentals keeps editable label.

## Tests

See user request: selector filter, legacy inactive visible, preview exclusion, discovery toggle, catalog label UX, empty eligible state.
