# 2026-09-02-catalog-product-image-carousel

Status: approved (user instruction)

## Goal

Browse all renderable product images in a carousel when a product has 2+ images. WEB-only. No API, no migration, no coverImage field.

## Audit

- **B2C list** `PortalCatalogPage`: `product.files[0]` in a card (`h-36 object-cover`). Zero images → no `<img>` (keep that).
- **B2C detail** `PortalCatalogProductPage`: same, `h-56`.
- **B2B** `CatalogProductsPage`: table, no thumbnails. Edit dialog lists files (Open/Delete). Not a card grid.
- **Cart** has no product images.
- **Deps:** no Embla/shadcn Carousel/Swiper. Do **not** add a carousel package. Lightweight component + lucide arrows. Optional CSS/pointer swipe.

## Shared component

`src/features/catalog/components/CatalogProductImageGallery.tsx` (+ `selectCatalogProductImages.ts` for mime filter + tests).

Filter jpeg/png/webp (`image/jpeg`, `image/png`, `image/webp`) in API file order. Skip missing URL. Portal files are already customer-visible; still mime-filter. B2B dialog: gallery of image files that have a URL; keep the existing file list for all attachments (PDFs stay there).

## Behavior

- 0 images: render nothing (existing fallback).
- 1 image: `<img>` only, no arrows/dots/count.
- 2+: carousel, no autoplay, loop, overlay prev/next, dots if count ≤ 8 else `1 / N`.
- Stable viewport (fixed height via className), `object-contain`, never stretch.
- Broken URL: per-slide fallback; other slides still work. Loading: keep frame.
- Keyboard left/right when the gallery is focused. Pointer swipe if cheap.

## Wire

- `PortalCatalogPage` cards
- `PortalCatalogProductPage` hero
- `CatalogProductsPage` edit dialog: image gallery above the file list when there are previewable images

## i18n

pt-BR / en / es: previous, next, image N of M, broken image. No hardcoded UI strings.

## Tests (Vitest + RTL)

zero → no img; one → no controls; two → controls; next/prev; loop; indicator; PDF excluded; broken img fallback.
