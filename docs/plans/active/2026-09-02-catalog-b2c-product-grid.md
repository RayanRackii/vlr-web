# 2026-09-02-catalog-b2c-product-grid

Status: approved (user instruction)

## Goal

Visual/layout redesign of B2C `/catalogo` into a compact commerce-style product grid. WEB-only. No API, no migration, no cart/order/contract/behavior changes.

## Do not change

Sidebar, AppShell header, cart logic, order/request contracts, catalog API, product-detail page behavior (except leaving it alone), carousel loop/filter/swipe logic, file visibility, tenant branding system (`resolveTenantTheme` / outlet `primary`).

## Layout

- Centered content: `mx-auto w-full max-w-[1440px]`.
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` with compact gap. Stop two full-width cards on desktop.
- Header: title + [Solicitar produto] [Carrinho (N)] on one row; subtitle below; search full-width under that. Compact, aligned with the grid. No new Filters control (none exists).
- Keep search debounce, request link, cart link, empty/error/loading, bottom `PortalCartPanel` when cart has items.

## Product card (`PortalCatalogProductCard`)

Reusable card used by `PortalCatalogPage`.

Structure: image → code (muted xs) → name (primary, clamp 2 lines, reserved height) → price / Sob consulta → footer (qty stepper + full-width Adicionar).

- Image: reuse `CatalogProductImageGallery`. Frame `aspect-[4/3] w-full`, `object-contain` already in gallery. Zero images: stable muted placeholder frame (card-level; do not change gallery default `null` for B2B/detail).
- Optional gallery prop `controlsVisibility="hover"`: arrows hidden until hover on `md+`; always visible on small screens. Default `"always"` so B2B edit + product detail stay as they are. Do not change swipe/keyboard/loop/filter.
- Image + name (and code/price block) navigate to `catalogo/:id`. Do **not** wrap qty/Add in the Link. Carousel controls already `stopPropagation`.
- Quantity: `[−] input [+]`. Min 1 (same as today: invalid/empty → 1). Keep manual typing in the input. No max (unchanged). `cart.add(product.id, qty)` unchanged.
- Add: full-width primary in the card footer; keep tenant `primary` via `style={{ backgroundColor: primary }}` plus readable foreground token. Toast `addedToCart` unchanged.
- Cards `h-full flex flex-col`; footer `mt-auto`. Semantic tokens (`bg-card`, `border-border`, `text-muted-foreground`). No huge shadow/gradient. `rounded-xl` max.
- i18n: reuse existing catalog strings; add only decrease/increase quantity labels (+ empty-image if needed). pt-BR / en / es.

## Tests

`PortalCatalogProductCard.test.tsx` (and page smoke if cheap):
- card renders code / name / price
- zero images → placeholder frame, no img
- one image → no next/prev
- Add still calls add + toast
- quantity +/− and typed value
- name/image region links to product detail

## ROADMAP

Checklist line under Catalog §6 + Histórico 2026-09-02.
