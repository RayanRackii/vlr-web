import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { FormPrimaryButton } from "@/components/ui/form-primary-button"
import { Textarea } from "@/components/ui/textarea"
import { CatalogQuantityField } from "@/features/catalog/components/CatalogQuantityField"
import {
  formatCartTotalText,
  formatLineSubtotal,
} from "@/features/catalog/lib/catalogPriceSummary"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { type PortalProduct } from "@/features/catalog/schemas/catalogSchemas"
import {
  createPortalCatalogOrder,
  listPortalCatalogProducts,
} from "@/features/catalog/services/catalogPortalService"
import { useCatalogCart } from "@/features/catalog/useCatalogCart"
import { getAgendaSessionGeneration } from "@/features/tenantPortal/lib/agendaQueryClient"
import {
  getCustomerId,
  tenantPortalPath,
} from "@/features/tenantPortal/services/tenantPortalService"

const checkoutSchema = z.object({
  customerNote: z.string().max(1000),
})

type CheckoutFormValues = z.infer<typeof checkoutSchema>

export function PortalCartPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { subdomain, primary } = useOutletContext<CustomerAppOutletContext>()
  const cart = useCatalogCart(subdomain, getCustomerId())
  const [products, setProducts] = useState<PortalProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { customerNote: "" },
  })
  const watchedCheckout = useWatch({ control: form.control })
  const isCheckoutValid = checkoutSchema.safeParse(watchedCheckout).success

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listPortalCatalogProducts()
      .then((data) => {
        if (!cancelled) {
          setProducts(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([])
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
  }, [])

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )
  const onRequestLabel = t("tenantPortal.catalog.priceOnRequest")
  const cartLines = cart.items.map((item) => {
    const product = productMap.get(item.productId)
    return {
      price: product?.price ?? null,
      currency: product?.currency ?? "",
      quantity: item.quantity,
    }
  })
  const cartTotalLabel = formatCartTotalText(cartLines, i18n.language, {
    onRequest: onRequestLabel,
    partial: (amount) => t("tenantPortal.catalog.fromAmount", { amount }),
  })

  async function onSubmit(values: CheckoutFormValues) {
    if (cart.items.length === 0) {
      toast.error(t("tenantPortal.catalog.cartEmpty"))
      return
    }
    const generation = getAgendaSessionGeneration()
    setSubmitting(true)
    try {
      const order = await createPortalCatalogOrder({
        items: cart.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        customerNote:
          values.customerNote.trim().length > 0
            ? values.customerNote.trim()
            : undefined,
      })
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
      cart.clear()
      toast.success(t("tenantPortal.catalog.orderSubmitted"))
      void navigate(tenantPortalPath(subdomain, `pedidos/${order.id}`))
    } catch (error) {
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.submitPortalOrder"),
      )
    } finally {
      if (generation === getAgendaSessionGeneration()) {
        setSubmitting(false)
      }
    }
  }

  if (loading) {
    return <PageContentSkeleton rows={4} />
  }

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
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("tenantPortal.catalog.cartTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.checkoutHint")}
        </p>
      </div>

      {cart.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.cartEmpty")}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border border-border">
          {cart.items.map((item) => {
            const product = productMap.get(item.productId)
            return (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {product?.name ?? item.productId}
                  </p>
                  <p className="text-muted-foreground">
                    {t("tenantPortal.catalog.lineSubtotal")}:{" "}
                    {formatLineSubtotal(
                      product?.price ?? null,
                      product?.currency ?? "",
                      item.quantity,
                      i18n.language,
                      onRequestLabel,
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CatalogQuantityField
                    className="w-20"
                    quantity={item.quantity}
                    productName={product?.name ?? item.productId}
                    onCommit={(next) => {
                      cart.update(item.productId, next)
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      cart.remove(item.productId)
                    }}
                  >
                    {t("tenantPortal.catalog.removeItem", {
                      name: product?.name ?? item.productId,
                    })}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {cart.items.length > 0 ? (
        <p className="text-sm font-medium">
          {t("tenantPortal.catalog.cartTotal")}: {cartTotalLabel}
        </p>
      ) : null}

      {cart.items.length > 0 ? (
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <FormField
              control={form.control}
              name="customerNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tenantPortal.catalog.customerNote")}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={1000} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    {field.value.length}/1000
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormPrimaryButton
              type="submit"
              className="w-full"
              isValid={isCheckoutValid}
              loading={submitting}
              disabled={cart.items.length === 0}
              loadingLabel={t("tenantPortal.catalog.submitting")}
              style={{ backgroundColor: primary }}
            >
              {t("tenantPortal.catalog.submitOrder")}
            </FormPrimaryButton>
          </form>
        </Form>
      ) : null}
    </div>
  )
}
