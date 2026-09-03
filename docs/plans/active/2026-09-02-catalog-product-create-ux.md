# 2026-09-02-catalog-product-create-ux

Status: approved (user P2 instruction)

## Goal

Catalog B2B **New Product** is one save: generate Code from Name, attach files before the product exists, POST product then upload files. Do not flip the modal to Edit Product after create.

## Repositories

- vlr-web only. **API_CHANGE_REQUIRED = NO.** **MIGRATION_REQUIRED = NO.**
- Reuse `POST /api/catalog/products` and `POST /api/catalog/products/{id}/files`. Duplicate code remains 409 `{ error }` from the API.

## P2.1 Code generator

Utility (not inline in the page): `src/features/catalog/lib/generateProductCode.ts`.

- Ignore connectors (after accent-normalize, case-insensitive): `de da do das dos e em para por com a o`
- Significant word → first letter; numbers collected after a single `-`
- Uppercase; strip accents (NFD)
- One significant word must not become one letter: use up to 3 letters (`Cabide` → `CAB`, `Notebook` → `NOT`, `Projetor` → `PRO`; shorter words keep all letters)
- Code stays editable. Until the user edits Code, Name changes regenerate it. After a manual Code edit, never overwrite. Edit mode never regenerates the persisted code.
- Do not append uniqueness suffixes. 409 is visible via `parseApiError`.

Stopword vs example: `Cadeira de Praia 2000` listed as `CDP-2000` contradicts ignoring `de` (same rule as `Dobradiça de Scanner Canon 1643` → `DSC-1643`). **Canonical: apply the stopword list** → `CP-2000`.

## P2.2 Create + files

Create modal shows file picker before `productId`. Selected files live in frontend state. Save:

1. If no `createdProductId` yet → `POST /api/catalog/products` once
2. Store `createdProductId`
3. Upload only pending/failed files to `POST .../products/{id}/files`
4. All uploads succeed → toast, close modal (still **create** title; do not switch to edit)
5. Partial failure → keep modal open, keep `createdProductId`, mark failed files, do not recreate the product, do not re-upload `sent` files

Edit mode: existing file list + immediate upload as today. Do not use the create pending-queue for edit.

## P2.3 Upload states

Per pending file: `waiting` | `sending` | `sent` | `error`. Retry per failed file. Primary: Salvar → Salvando... (`FormPrimaryButton` + `catalogProductFormSchema.safeParse` on watched values). Block double submit and dialog dismiss while the create/upload operation is running. Cancel is not validity-gated; disable Cancel only while an operation is in flight.

## Structure

Do not rewrite `CatalogProductsPage`. Extract small pieces:

- `generateProductCode` + tests
- `createCatalogProductWithFiles` (or equivalent) orchestration + tests (inject create/upload)
- Optional dialog extract only if the page stays readable

Reuse existing `accept` mime lists. Do not broaden types. i18n in pt-BR/en/es.

## Tests

Vitest: generator examples (incl. accents, spaces, hyphens, stopwords, single-word, short names); manual override + edit-mode preservation; orchestration (create once, uploads after id, success closes, partial failure retains id, retry skips sent, double-submit guard). Component tests where cheap (validity gate, file list before product exists).

## Do not

Touch vlr-api, main, PROD, migrations, Rentals, WhatsApp, Twilio.
