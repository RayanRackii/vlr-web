import "../components/portalCatalog.css"

import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { ArrowLeft, Package, Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PortalAddToCartButton } from "@/features/catalog/components/PortalAddToCartButton"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  CATALOG_CART_MAX_QUANTITY,
  CATALOG_CART_MIN_QUANTITY,
  clampCatalogQuantity,
} from "@/features/catalog/cart"
import { CatalogProductImageGallery } from "@/features/catalog/components/CatalogProductImageGallery"
import { CatalogQuantityField } from "@/features/catalog/components/CatalogQuantityField"
import { selectCatalogProductImages } from "@/features/catalog/lib/selectCatalogProductImages"
import {
  formatCatalogMoney,
  type PortalProduct,
} from "@/features/catalog/schemas/catalogSchemas"
import { getPortalCatalogProduct, PortalProductUnavailableError } from "@/features/catalog/services/catalogPortalService"
import { useCatalogCart } from "@/features/catalog/useCatalogCart"
import {
  getCustomerId,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

export function PortalCatalogProductPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const params = useParams()
  const { subdomain, primary } = useOutletContext<CustomerAppOutletContext>()
  const productId = params.productId ?? ""
  const cart = useCatalogCart(subdomain, getCustomerId())

  const [product, setProduct] = useState<PortalProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const quantityRef = useRef(quantity)
  quantityRef.current = quantity

  function commitQuantity(next: number) {
    const clamped = clampCatalogQuantity(next)
    quantityRef.current = clamped
    setQuantity(clamped)
  }

  useEffect(() => {
    if (!productId) {
      setLoadError(t("apiErrors.loadPortalCatalogProduct"))
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void getPortalCatalogProduct(productId)
      .then((data) => {
        if (!cancelled) {
          setProduct(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setUnavailable(error instanceof PortalProductUnavailableError)
          setLoadError(
            error instanceof Error
              ? error.message
              : t("apiErrors.loadPortalCatalogProduct"),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [productId, t])

  if (loading) {
    return <PageContentSkeleton rows={4} />
  }

  if (unavailable) {
    return (
      <div className="portal-catalog-detail-panel space-y-4 min-w-0" role="status">
        <h1 className="text-xl font-semibold">{t("tenantPortal.catalog.unavailableTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("tenantPortal.catalog.unavailableBody")}</p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            void navigate(tenantPortalPath(subdomain, "catalogo"))
          }}
        >
          {t("tenantPortal.catalog.backToCatalog")}
        </Button>
      </div>
    )
  }

  if (loadError || !product) {
    return (
      <div className="portal-catalog-detail-panel space-y-6 min-w-0">
        <p className="text-sm text-destructive">
          {loadError ?? t("apiErrors.loadPortalCatalogProduct")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            void navigate(tenantPortalPath(subdomain, "catalogo"))
          }}
        >
          {t("common.back")}
        </Button>
      </div>
    )
  }

  const images = selectCatalogProductImages(product.files)
  const priceLabel =
    formatCatalogMoney(product.price, product.currency, i18n.language) ??
    t("tenantPortal.catalog.priceOnRequest")

  return (
    <div className="portal-catalog-detail min-w-0 space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="lg"
        render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
      >
        <ArrowLeft aria-hidden data-icon="inline-start" />
        {t("common.back")}
      </Button>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {images.length === 0 ? (
          <div
            className="portal-catalog-image portal-catalog-placeholder rounded-[18px] border border-border"
            aria-label={t("tenantPortal.catalog.noImage")}
          >
            <Package aria-hidden />
          </div>
        ) : (
          <CatalogProductImageGallery
            images={images}
            alt={product.name}
            frameClassName="portal-catalog-image rounded-[18px] border border-border"
          />
        )}

        <div className="portal-catalog-detail-panel space-y-6 min-w-0">
          <div className="space-y-2">
            {product.isExclusive ? (
              <div className="space-y-1">
                <Badge variant="outline" className="w-fit">
                  {t("tenantPortal.catalog.exclusive")}
                </Badge>
                <p className="text-xs text-muted-foreground">{t("tenantPortal.catalog.exclusiveWhy")}</p>
              </div>
            ) : null}
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
            {product.code ? (
              <p className="text-sm text-muted-foreground">{product.code}</p>
            ) : null}
            {product.price == null ? (
              <Badge variant="warning">{t("tenantPortal.catalog.priceOnRequest")}</Badge>
            ) : (
              <p className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground">{priceLabel}</p>
            )}
            {product.description ? (
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            ) : null}
          </div>

          <div className="portal-catalog-detail-actions min-w-0">
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
                className="h-11 w-16 px-1 text-center"
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
            <PortalAddToCartButton
              type="button"
              className="portal-catalog-button portal-catalog-primary min-w-0 flex-1 text-primary-foreground"
              style={{ backgroundColor: primary }}
              onClick={() => {
                cart.add(product.id, quantityRef.current)
                toast.success(t("tenantPortal.catalog.addedToCart"))
              }}
            >
              {t("tenantPortal.catalog.addToCart")}
            </PortalAddToCartButton>
          </div>
        </div>
      </div>
    </div>
  )
}
