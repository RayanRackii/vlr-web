import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { ImageOff, Minus, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
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
import { getPortalCatalogProduct } from "@/features/catalog/services/catalogPortalService"
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

  if (loadError || !product) {
    return (
      <div className="space-y-4">
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
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-24 md:pb-0">
      <Button
        type="button"
        variant="ghost"
        size="lg"
        render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
      >
        {t("common.back")}
      </Button>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {images.length === 0 ? (
          <div
            className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted text-muted-foreground"
            aria-label={t("tenantPortal.catalog.noImage")}
          >
            <ImageOff aria-hidden className="size-8" />
          </div>
        ) : (
          <CatalogProductImageGallery
            images={images}
            alt={product.name}
            frameClassName="aspect-[4/3] w-full rounded-xl"
          />
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
            {product.code ? (
              <p className="text-sm text-muted-foreground">{product.code}</p>
            ) : null}
            {product.price == null ? (
              <Badge variant="warning">{t("tenantPortal.catalog.priceOnRequest")}</Badge>
            ) : (
              <p className="text-xl font-semibold tracking-tight text-foreground">{priceLabel}</p>
            )}
            {product.description ? (
              <p className="text-sm text-muted-foreground">{product.description}</p>
            ) : null}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 border-t border-border bg-background px-4 pt-3 md:static md:z-auto md:pb-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
            <div className="flex shrink-0 items-center gap-2">
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
            <LoadingButton
              type="button"
              className="h-11 flex-1"
              style={{ backgroundColor: primary }}
              onClick={() => {
                cart.add(product.id, quantityRef.current)
                toast.success(t("tenantPortal.catalog.addedToCart"))
              }}
            >
              {t("tenantPortal.catalog.addToCart")}
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  )
}
