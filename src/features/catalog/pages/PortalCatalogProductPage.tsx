import { useEffect, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { CatalogProductImageGallery } from "@/features/catalog/components/CatalogProductImageGallery"
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
    <div className="mx-auto max-w-xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
      >
        {t("common.back")}
      </Button>

      <CatalogProductImageGallery
        images={images}
        alt={product.name}
        frameClassName="h-56 w-full rounded-xl"
      />

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">{product.name}</h1>
        {product.code ? (
          <p className="text-sm text-muted-foreground">{product.code}</p>
        ) : null}
        {product.price == null ? (
          <Badge variant="warning">{t("tenantPortal.catalog.priceOnRequest")}</Badge>
        ) : (
          <p className="text-base font-medium">{priceLabel}</p>
        )}
        {product.description ? (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          className="w-24"
          value={quantity}
          aria-label={t("tenantPortal.catalog.quantity")}
          onChange={(event) => {
            const next = Number(event.target.value)
            setQuantity(Number.isFinite(next) && next > 0 ? next : 1)
          }}
        />
        <LoadingButton
          type="button"
          className="flex-1"
          style={{ backgroundColor: primary }}
          onClick={() => {
            cart.add(product.id, quantity)
            toast.success(t("tenantPortal.catalog.addedToCart"))
          }}
        >
          {t("tenantPortal.catalog.addToCart")}
        </LoadingButton>
      </div>
    </div>
  )
}
