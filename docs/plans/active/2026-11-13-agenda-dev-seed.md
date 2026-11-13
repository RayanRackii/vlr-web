# DEV seed for the agenda screen (2026-11-13)

Repositories: vlr-web only (a dev tool, no product code). Branch: `chore/agenda-dev-seed`.
Decisions by the user: DEV first (tenant `zzr14locacao`), next 14 days from 2026-11-13, every day,
about 5 orders per day, 3 hours each, machines open 08:00–22:00. Purpose: realistic data for the
upcoming refactor of Agendas → Visão geral (`/agendas`).

## How an order lands on the agenda (verified in vlr-api develop)
1. Staff product with a resource requirement:
   `PUT /api/catalog/products/{id}/resource-requirements`
   `{ expectedVersion, requirements: [{ rentalAssetId | assetCategoryId, resourceQuantity: 1, durationMinutesPerUnit: 180, prepMinutes: 0, cleanupMinutes: 0 }] }`
   (read the current `expectedVersion` with `GET` first).
2. Portal customer creates the order: `POST /api/catalog/portal/orders`
   `{ items: [{ productId, quantity: 1 }], customerNote }` with the customer token and header
   `X-Tenant-Subdomain: zzr14locacao` (see `e2e/clients.ts` `customerClient`).
3. Staff approves with planning: `POST /api/catalog/orders/{id}/approve`
   `{ unitId, workStart: "<ISO with -03:00 offset>", expectedVersion }`. The allocation must fit one
   local day and, for `OpenHours` resources, inside `openTime`–`closeTime`
   (`ResourceWorkWindowValidator`). A conflict answers 409 with a code; do not retry blindly.
Exact request shapes: `openapi/openapi.json` (rental assets create/update, schedule policy, catalog
products create). Tenant facts on DEV today: unit "Matriz" `c2fa406c-…` (read the full id from
`GET /api/units`), modules catalog + rentals + resource-planning, smoke admin has
`catalog.orders.allocate`. 25 smoke orders and 7 resources already exist: do not modify or delete them.

## What to build
`scripts/seed-agenda-dev.mjs` (plain Node ESM, run with `node scripts/seed-agenda-dev.mjs`):
- Guard: refuse to run unless `E2E_API_URL` host is `rolvix-api-dev.fly.dev` and the tenant is
  `zzr14locacao` (same spirit as the e2e guard in `e2e/env.ts`). Never PROD, never FICC.
- Credentials only from `vlr-web/.env.e2e.local` (`SMOKE_ZZR14_B2B_*`, `SMOKE_ZZR14_CUSTOMER_*`,
  `E2E_WEB_URL`, `E2E_API_URL`); parse without echoing values. Get tokens the way the e2e setup
  does: Playwright UI login (`e2e/auth-ui.ts` helpers), then read the staff Supabase session
  (`sb-*-auth-token` in localStorage) and the customer token (storage key in `src/lib/api.ts`).
  Never print tokens.
- Idempotent setup (find by name, create if missing):
  - 3 resources (rental assets) named `Impressora 3D Alfa`, `Impressora 3D Beta`,
    `Cortadora Laser Gama`, unit Matriz, schedule policy `OpenHours`, open `08:00`, close `22:00`,
    every day, active.
  - 1 public, active catalog product per resource, e.g. `Impressão 3D – Alfa (3h)`, each with one
    requirement on its resource, `durationMinutesPerUnit: 180`, visible to the portal customer.
- Orders: for each day D from 2026-11-13 to 2026-11-26 (America/Sao_Paulo), 5 orders using this
  pattern of (resource, start): Alfa 08:00, Alfa 14:00, Beta 09:00, Beta 15:00, Gama 19:00
  (19:00 + 3h = 22:00). Vary the order of creation and the customer note so it reads like real use
  (e.g. "Peça de reposição", "Protótipo cliente", "Brinde evento"). Tag every note with
  `[seed-agenda]` and skip a (day, resource, start) that already has a seeded order, so a rerun
  only fills gaps. Approve each with its workStart. Make today's 08:00 order `preparing` after
  approval (`POST /orders/{id}/preparing`) for some status variety; leave the rest approved.
- Output: a short summary table (day → created / skipped / failed with error code). Exit non-zero
  on any unexpected failure.
- Add `"seed:agenda:dev": "node scripts/seed-agenda-dev.mjs"` to package.json scripts and a short
  section in `docs/` or the script header on what it does and how to rerun.

## Out of scope
UI changes, API changes, other tenants, cleanup/deletion tooling.

## Done when
- The script ran once against DEV successfully: 70 orders on the 3 new resources across 14 days,
  0 failures; a second run creates 0 and skips 70.
- `npm run lint:ratchet` passes for the new file (or the script is excluded the same way other
  `scripts/*.mjs` are).
- Committed as `chore(agenda): add a DEV seed for agenda overview data` (body + the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), pushed, PR to `develop` whose body
  ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
