# Gammera UI audit fixes (web)

Source: DEV audit of tenant gammera on 2026-11-20 (modules catalog, inventory, os, pmoc,
resource-planning; rentals OFF), at 1440 and 375 px in pt-BR, en and es. The full report has 20
findings; this spec covers the web-only ones. Generic product: no tenant-specific code and no rental
wording on non-rental tenants.

## Fixes (one PR, `fix/gammera-ui-audit`)

| # | Problem | Where | Fix |
|---|---|---|---|
| 1 | Product request detail shows the customer GUID as "Cliente" | `src/features/catalog/pages/PedidoRequestDetailPage.tsx:23` | Show the customer name, and the e-mail when the response has it. Check the request DTO in `openapi/openapi.json`. If the API returns no name, show "—" and never the id, and note it in the PR as an API follow-up. |
| 2 | `/ativos/tipos` calls `/api/rentals/resource-types` and shows "módulo não está ativo" with a retry that can never succeed | `src/features/assets/resourceTypes/resourceTypesService.ts:63`, the Tipos page and tab, `common.json:3303` subtitle | Resource types belong to rentals: hide the "Tipos" tab/route when the tenant has no `rentals` module (use the existing module-access helper the sidebar uses). Direct navigation shows the standard module-inactive state, not an error with retry. Make the subtitle generic. |
| 3 | `/configuracoes/menu` calls `/api/rental-assets` (403 when rentals is off) | `src/features/admin/components/ModuleMenuItemsManager.tsx:255` | Only call rental endpoints when `rentals` is active. Otherwise skip the query and hide the rental-only part of the form. No 403 in the console. |
| 4 | `/agendas` and `/agendas/produto` get 403 on `/api/catalog/agenda/resources` | `src/features/agenda/agendaQueries.ts` | Check the API attributes of that endpoint (vlr-api `CatalogAgenda*Controller`): which module and permission does it need? If it needs `rentals`, don't call it when rentals is off, and hide the "pedidos" lane with no error banner. If it is only a permission the platform admin lacks while impersonating, document that in the PR and change nothing. |
| 5 | `/agendas/recursos` gets 403 on `/api/rentals/resource-types` | resource agenda page | Same module guard as #2. Also note the 409 on `/api/users/me/tenants`: reproduce it with a tenant admin session if possible. If it only happens for the impersonating platform admin, document it and do not change it. |
| 6 | `document.title` is "Gammera Solutions DEV · Rolvix" on every staff page; the signed-in customer portal shows only "Rolvix" | `src/hooks/useTenantDocumentMeta.ts:60-80`, `MainLayout.tsx:105`, `TenantPortalLayout.tsx:70`, `CustomerAppLayout.tsx` | Title = `<page title> · <tenant> · Rolvix`. Use the page title the shell already has (`pageTitle` / Page header title), or `<tenant> · Rolvix` when there is none. Add the same meta to `CustomerAppLayout`. |
| 7 | `/pmoc/biblioteca` and its detail page show h1 and breadcrumb "Novo plano" | PMOC library routes and breadcrumb mapping | Correct title, for example `t("pmoc.library.title")`; add the key if it is missing. The breadcrumb crumb must name the library. |
| 8 | `/os/:id` h1 is the asset name with the status "Pendente" inside the heading | work-order detail page | h1 = "OS #<n>" (asset name as subtitle); the status chip goes outside the `<h1>`. |
| 9 | Rental copy on non-rental tenants: portal login subtitle "…fazer reservas…" (`common.json:570`) and the product wizard "…pronto para receber reservas" (`common.json:6350`) | locales pt-BR/en/es | Generic wording ("acompanhar seus pedidos e atividades"). Where rental wording is still right for rental tenants, branch on the tenant modules. |
| 10 | `/ativos/tipos/novo` preview shows "Escolha um …" / "3 … disponíveis" with an empty name | `src/features/assets/pages/ResourceTypeWizardPage.tsx:311-312, 410-411` | Fall back to a generic noun ("recurso") when the name is empty. |
| 11 | Rentals-off settings routes show "Acesso negado" instead of a module-inactive message; `/configuracoes/recursos` has no heading and an empty title | `src/components/layout/AccessDeniedPage.tsx` and the route guards | Tell "module inactive" apart from "no permission": show a page "Este módulo não está ativo para esta empresa" with a link back. `/configuracoes/recursos` gets a heading and a title. |
| 12 | "portal B2C" jargon | `common.json:4666, 4691, 4716` (pt-BR/en/es) | "portal do cliente". |
| 13 | Product wizard overflows by 188 px at 375 px | `/catalogo/produtos/cadastro` | Fix the overflowing element (check the screenshot list). No horizontal scroll at 375 px. |
| 14 | Low: portal catalog h1 "Catálogo 5 itens" (count inside the heading); "Exclusão Pendente" / "Em Andamento" capitalisation | portal catalog page; locales | Count outside the `<h1>`; sentence case "Em andamento", "Exclusão pendente". |

Out of scope (API follow-ups, listed in the PR):
- family names and "Quantidade típica (optional)" come from API seed data (`AddAssetFamilies` migration);
- server-generated order timeline messages stay in pt-BR in en/es.

## Tests
- vitest for each logic change:
  - #1: request detail renders the name and never a GUID;
  - #2/#3/#5: with rentals off, no rental endpoint is called and the Tipos tab is hidden;
  - #6: the title includes the page title;
  - #8: the status chip is outside the h1;
  - #10: empty-name fallback;
  - #11: the module-inactive page differs from access denied.
- Run `npx vitest run` on the touched folders, `npx tsc -b --noEmit`, `npm run lint:ratchet`, `npm run check:api`.

## Done when
All rows are fixed or documented in the PR, the tests are green, and a DEV re-check of the same routes shows no 4xx from rental endpoints on gammera and no GUIDs.
