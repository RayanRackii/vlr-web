import { Package, Minus, Plus } from "lucide-react"
import { useRef } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PortalAddToCartButton } from "@/features/catalog/components/PortalAddToCartButton"
import { CatalogQuantityField } from "@/features/catalog/components/CatalogQuantityField"
import {
  CATALOG_CART_MAX_QUANTITY,
  CATALOG_CART_MIN_QUANTITY,
  clampCatalogQuantity,
} from "@/features/catalog/cart"
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

export function PortalCatalogProductCard({
  product,
  subdomain,
  quantity,
  onQuantityChange,
  onAdd,
  primary,
}: PortalCatalogProductCardProps) {
  const { t, i18n } = useTranslation()
  const quantityRef = useRef(quantity)
  quantityRef.current = quantity

  function commitQuantity(next: number) {
    const clamped = clampCatalogQuantity(next)
    quantityRef.current = clamped
    onQuantityChange(clamped)
  }

  const images = selectCatalogProductImages(product.files)
  const detailTo = tenantPortalPath(subdomain, `catalogo/${product.id}`)
  const priceLabel =
    formatCatalogMoney(product.price, product.currency, i18n.language) ??
    t("tenantPortal.catalog.priceOnRequest")

  return (
    <article className="portal-catalog-card">
      {images.length === 0 ? (
        <Link
          to={detailTo}
          className="portal-catalog-image portal-catalog-placeholder"
          aria-label={t("tenantPortal.catalog.noImage")}
        >
          <Package aria-hidden />
        </Link>
      ) : (
        <CatalogProductImageGallery
          images={images}
          alt={product.name}
          frameClassName="portal-catalog-image"
          controlsVisibility="hover"
          imageLinkTo={detailTo}
        />
      )}
      <div className="portal-catalog-body">
        {product.taxonomy?.categories.length || product.taxonomy?.tags.length ? (
          <div className="portal-catalog-tags">
            {product.taxonomy.categories.map((category) => <span key={category.id} className="portal-catalog-tag">{category.name}</span>)}
            {product.taxonomy.tags.map((tag) => <span key={tag.id} className="portal-catalog-tag">{tag.name}</span>)}
          </div>
        ) : null}
        <Link to={detailTo} className="text-inherit no-underline">
          {product.code ? <p className="mb-1 break-words text-xs text-muted-foreground">{product.code}</p> : null}
          <h2 className="portal-catalog-product-name">{product.name}</h2>
        </Link>
        <div className="portal-catalog-price-row">
          {product.price == null ? (
            <Badge variant="warning" className="whitespace-normal">
              {t("tenantPortal.catalog.priceOnRequest")}
            </Badge>
          ) : (
            <p className="portal-catalog-price">{priceLabel}</p>
          )}
          <PortalAddToCartButton
            type="button"
            className="portal-catalog-add portal-catalog-primary text-primary-foreground hover:opacity-90"
            style={{ backgroundColor: primary }}
            aria-label={t("tenantPortal.catalog.addToCart")}
            onClick={onAdd}
          >
            <Plus aria-hidden />
          </PortalAddToCartButton>
        </div>
        <div className="portal-catalog-stepper">
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("tenantPortal.catalog.quantityDecrease")}
            disabled={quantity <= CATALOG_CART_MIN_QUANTITY}
            onClick={() => {
              commitQuantity(quantityRef.current - 1)
            }}
          >
            <Minus aria-hidden />
          </Button>
          <CatalogQuantityField
            quantity={quantity}
            productName={product.name}
            onCommit={commitQuantity}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={t("tenantPortal.catalog.quantityIncrease")}
            disabled={quantity >= CATALOG_CART_MAX_QUANTITY}
            onClick={() => {
              commitQuantity(quantityRef.current + 1)
            }}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  )
}
