import { ImageOff, Minus, Plus } from "lucide-react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { CatalogProductImageGallery } from "@/features/catalog/components/CatalogProductImageGallery"
import { selectCatalogProductImages } from "@/features/catalog/lib/selectCatalogProductImages"
import {
  formatCatalogMoney,
  type PortalProduct,
} from "@/features/catalog/schemas/catalogSchemas"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

export type PortalCatalogProductCardProps = {
  product: PortalProduct
  subdomain: string
  quantity: number
  onQuantityChange: (quantity: number) => void
  onAdd: () => void
  primary: string
}

function parseQuantity(raw: string): number {
  const next = Number(raw)
  return Number.isFinite(next) && next > 0 ? next : 1
}

export function PortalCatalogProductCard({
  product,
  subdomain,
  quantity,
  onQuantityChange,
  onAdd,
  primary,
}: PortalCatalogProductCardProps) {
  const { t, i18n } = useTranslation()
  const images = selectCatalogProductImages(product.files)
  const detailTo = tenantPortalPath(subdomain, `catalogo/${product.id}`)
  const priceLabel =
    formatCatalogMoney(product.price, product.currency, i18n.language) ??
    t("tenantPortal.catalog.priceOnRequest")

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      {images.length === 0 ? (
        <Link
          to={detailTo}
          className="flex aspect-[4/3] w-full items-center justify-center rounded-t-lg bg-muted text-muted-foreground"
          aria-label={t("tenantPortal.catalog.noImage")}
        >
          <ImageOff aria-hidden className="size-8" />
        </Link>
      ) : (
        <CatalogProductImageGallery
          images={images}
          alt={product.name}
          frameClassName="aspect-[4/3] w-full rounded-t-lg"
          controlsVisibility="hover"
          imageLinkTo={detailTo}
        />
      )}
      <Link
        to={detailTo}
        className="flex flex-1 flex-col gap-1 px-3 pt-3 text-inherit no-underline"
      >
        <p className="min-h-4 text-xs text-muted-foreground">
          {product.code ?? "\u00a0"}
        </p>
        <h2 className="min-h-[2.75rem] font-medium leading-snug line-clamp-2">
          {product.name}
        </h2>
        <div className="flex min-h-6 items-center">
          {product.price == null ? (
            <Badge variant="warning">
              {t("tenantPortal.catalog.priceOnRequest")}
            </Badge>
          ) : (
            <p className="text-base font-semibold tracking-tight text-foreground">
              {priceLabel}
            </p>
          )}
        </div>
      </Link>
      <div className="mt-auto flex flex-col gap-2 p-3 pt-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tenantPortal.catalog.quantityDecrease")}
            disabled={quantity <= 1}
            onClick={() => {
              onQuantityChange(Math.max(1, quantity - 1))
            }}
          >
            <Minus aria-hidden />
          </Button>
          <Input
            type="number"
            min={1}
            className="h-8 min-w-0 flex-1 px-1 text-center"
            value={quantity}
            aria-label={t("tenantPortal.catalog.quantity")}
            onChange={(event) => {
              onQuantityChange(parseQuantity(event.target.value))
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("tenantPortal.catalog.quantityIncrease")}
            onClick={() => {
              onQuantityChange(quantity + 1)
            }}
          >
            <Plus aria-hidden />
          </Button>
        </div>
        <LoadingButton
          type="button"
          className="w-full text-primary-foreground hover:opacity-90"
          style={{ backgroundColor: primary }}
          onClick={onAdd}
        >
          {t("tenantPortal.catalog.addToCart")}
        </LoadingButton>
      </div>
    </article>
  )
}
