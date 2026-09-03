# Portal menu — module discovery tab (WEB-only)

Repositories: `vlr-web`
Branch: `feat/portal-menu-module-discovery-tab`
Date: 2026-09-03

## Goal

Move “Amplie seu portal” off Configuração do menu into a second underline tab **Explore módulos**, matching Pessoas e acesso / Escala.

## Module catalog (canonical WEB)

`MODULE_KEYS` in `adminTenantSchemas.ts`: Inventory, PMOC, OS, Rentals, Catalog. Do not add `maintenance` or invented modules.

Categories (presentation metadata only, centralized map):

- customer: Catalog, Rentals
- operations: PMOC, Inventory, OS

Active state: `usePermissions().activeModules` + `toCanonicalModuleName`.

## Tabs

Keep `ModuleMenuItemsManager` **mounted** (hide via CSS) so builder/preview state survives tab switches.

Preview only on configuration tab. No discovery cards in the manager.

Regular tenant admin: informational cards, **no Ativar**. Super-Admin tenant edit already has module checkboxes; this page CTA `#tenant-modules` is optional only if `tenantId` embed is used — B2B `/configuracoes/menu` has no activation flow.
