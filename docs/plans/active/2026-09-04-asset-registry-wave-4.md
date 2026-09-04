# 2026-09-04 — Asset Registry Wave 4 (WEB resource UX)

Status: approved (Rentals slice + PMOC/OS picker-read). PMOC/OS resource **creation** STOPPED (`RESOURCE_UX_API_GAP` + `USER_DECISION_REQUIRED`).

## Goal / Problem

Operate Rentals (and read PMOC/OS pickers) with the commercial module ON and `inventory` OFF. Never send users to `/ativos` when Ativos is not entitled. Never show “Asset Registry”.

## Repositories

- vlr-web (implementation)
- vlr-api (read-only; Wave 2 already on develop `6b71239`)

## Architecture route

- rolvix-architect
- Fable: `FABLE_MERGE_REVIEW_NOT_REQUIRED` unless a new write endpoint is added (not this PR)

## Execution route

- web-implementer then ui-implementer then web-reviewer

## Confirmed decisions

- `/ativos` stays inventory-gated.
- Rentals owns rentable create/edit via `POST/PUT /api/rental-assets` + `rentals.assets.*`.
- Ativos owns general asset CRUD when inventory is on.
- Do not reuse `AssetWizard` (it posts `POST /api/assets` / `inventory.assets.write`).
- PMOC/OS pickers switch to Wave 2 read endpoints. No category/asset create under `pmoc.*` / `os.*`.

## Invariants that must not break

- No auto-enable Inventory.
- No `inventory.*` checks on Wave 2 domain ops.
- Catalog-only tenants unchanged.
- `/ativos` UX unchanged when inventory is on.

## Implementation scope

### A. Rentals — `/configuracoes/recursos`

Nav: `nav.rentalsResources` near Agenda/Layout/Reservas. `modules: ["rentals"]`, `permission: "rentals.assets.read"`. Create/edit gated `rentals.assets.write`.

Endpoints:

- `GET /api/rental-assets` (`rentals.assets.read`) — existing `listAdminRentalAssets`
- `GET /api/rental-assets/categories` → `{ id, name }[]`
- `GET /api/rental-assets/families` → reuse `assetFamilyListSchema`
- `POST /api/rental-assets` body `CreateRentableRequest`
- `PUT /api/rental-assets/{id}` — `{id}` is **RentalAsset.Id**, not AssetId
- Units: `GET /api/units` (`core.units.read`) via existing `getUnits`

DTO fields: `Name, Tag, UnitId, CategoryId, FamilyId, RentalType (Location|Good), TotalQuantity, RequiresDeposit, QueueEnabled, QueueOpeningTime, Location`. JSON enums are strings.

Hydration gap (do not expand API): `RentalAssetResponse` has Name, UnitId, Type, TotalQuantity, RequiresDeposit, Queue*, CategoryId — **not** Tag, FamilyId, Location. Create still full. Edit prefills known fields; Tag/FamilyId/Location collected on the form (single family auto-selects FamilyId). Follow-up API: add those three to GET.

Empty states: no “Ativos”. CTA “Adicionar recurso” when categories exist. If zero categories: configuration guidance (tipos vêm do provisionamento Super-Admin), never `/ativos`.

Schedule `rentals.schedule.noAssets`: replace Ativos copy; CTA to `/configuracoes/recursos`.

Terminology: Espaço / Item alugável / Recurso — not “Ativo” in Rentals.

### B. PMOC picker

`CreatePlanPage`: `GET /api/maintenance-plans/asset-categories` (`pmoc.plans.read`). Empty categories: guidance, not “Vá para Ativos”. No category create.

### C. OS picker

`CreateWorkOrderPage`: `GET /api/work-orders/assets` (`os.work_orders.read`) `{ id, name, tag, unitId, categoryId, status }`. Drop `requiresMaintenance` client filter. Zero assets: guidance, not `/ativos`. No asset create.

## Do not

- Call `/api/assets`, `/api/asset-categories`, `/api/asset-families` from these flows
- Invent POST endpoints
- Duplicate Ativos CRUD inside Rentals
- Show Asset Registry
- Mix API work into this PR

## Test seams

Vitest: rental resources service/page, nav filter without inventory, schedule empty CTA, CreatePlanPage uses maintenance-plans categories, CreateWorkOrderPage uses work-orders/assets.

## Product-level how to test

Rentals ON / Inventory OFF: sidebar Recursos, no Ativos; create rentable; appears in Agenda.
PMOC ON / Inventory OFF: `/pmoc/novo` loads categories without 403 when seeded.
OS ON / Inventory OFF: `/os/nova` loads assets without 403 when any exist; empty guidance if none.
Inventory ON: `/ativos` unchanged.
Catalog-only: no Recursos nav.
