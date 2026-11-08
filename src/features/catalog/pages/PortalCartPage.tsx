import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Minus, Plus, ShoppingCartIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/PageHeader"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
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
import { PortalOrderSubmitError } from "@/features/catalog/components/PortalOrderFeedback"
import {
  CATALOG_CART_MAX_QUANTITY,
  CATALOG_CART_MIN_QUANTITY,
  clampCatalogQuantity,
} from "@/features/catalog/cart"
import {
  formatCartTotalText,
  formatLineSubtotal,
} from "@/features/catalog/lib/catalogPriceSummary"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  formatCatalogMoney,
  type PortalProduct,
} from "@/features/catalog/schemas/catalogSchemas"
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
  const [submitBar, setSubmitBar] = useState<HTMLDivElement | null>(null)
  const [submitBarHeight, setSubmitBarHeight] = useState(144)
  const noteGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!submitBar) return
    const noteGroup = noteGroupRef.current
    let frame = 0
    const revealFocusedNote = () => {
      cancelAnimationFrame(frame)
      // Native focus only reveals the textarea; wait for its scroll/layout before
      // checking the whole field, including the counter beneath it.
      frame = requestAnimationFrame(() => {
        if (!noteGroup?.contains(document.activeElement)) return
        if (getComputedStyle(submitBar).position !== "fixed") return
        let scroller = noteGroup.parentElement
        while (scroller) {
          if (/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight) break
          scroller = scroller.parentElement
        }
        if (!scroller) return
        const visibleBottom = Math.min(
          scroller.getBoundingClientRect().bottom,
          submitBar.getBoundingClientRect().top,
        )
        const overlap = noteGroup.getBoundingClientRect().bottom - visibleBottom
        if (overlap > 0) scroller.scrollTop += overlap
      })
    }
    const measure = () => {
      setSubmitBarHeight(submitBar.getBoundingClientRect().height)
      revealFocusedNote()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(submitBar)
    noteGroup?.addEventListener("focusin", revealFocusedNote)
    window.addEventListener("resize", revealFocusedNote)
    window.visualViewport?.addEventListener("resize", revealFocusedNote)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      noteGroup?.removeEventListener("focusin", revealFocusedNote)
      window.removeEventListener("resize", revealFocusedNote)
      window.visualViewport?.removeEventListener("resize", revealFocusedNote)
    }
  }, [submitBar])

  const [submitError, setSubmitError] = useState<string | null>(null)

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
    if (submitting) return
    if (cart.items.length === 0) {
      toast.error(t("tenantPortal.catalog.cartEmpty"))
      return
    }
    const generation = getAgendaSessionGeneration()
    setSubmitting(true)
    setSubmitError(null)
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
      void navigate(tenantPortalPath(subdomain, `pedidos/${order.id}`), { state: { justCreated: true } })
    } catch (error) {
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
      const message = error instanceof Error ? error.message : t("apiErrors.submitPortalOrder")
      setSubmitError(message)
      toast.error(message)
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
    <div
      className="portal-purchase-cart mx-auto w-full max-w-2xl space-y-6 pb-[calc(var(--cart-submit-height)+1rem)] md:pb-0"
      style={{ "--cart-submit-height": `${submitBarHeight}px` } as CSSProperties}
    >
      <Button
        type="button"
        variant="outline"
        size="lg"
        render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
      >
        {t("common.back")}
      </Button>
      <PageHeader
        title={t("tenantPortal.catalog.cartTitle")}
        description={t("tenantPortal.catalog.checkoutHint")}
      />

      {submitError ? (
        <PortalOrderSubmitError
          message={submitError}
          blocked={submitting || !isCheckoutValid || cart.items.length === 0}
          onRetry={() => { void form.handleSubmit(onSubmit)() }}
          onDismiss={() => setSubmitError(null)}
        />
      ) : null}

      {cart.items.length === 0 ? (
        <EmptyState
          icon={ShoppingCartIcon}
          title={t("tenantPortal.catalog.cartEmpty")}
          action={
            <Button
              type="button"
              variant="outline"
              className="touch-target"
              render={<Link to={tenantPortalPath(subdomain, "catalogo")} />}
            >
              {t("tenantPortal.catalog.requestSentCatalog")}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {cart.items.map((item) => {
            const product = productMap.get(item.productId)
            return (
              <li
                key={item.productId}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className="line-clamp-2 min-w-0 font-medium"
                    title={product?.name ?? item.productId}
                  >
                    {product?.name ?? item.productId}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="portal-cart-remove h-11 shrink-0"
                    aria-label={t("tenantPortal.catalog.removeItem", {
                      name: product?.name ?? item.productId,
                    })}
                    onClick={() => {
                      cart.remove(item.productId)
                    }}
                  >
                    {t("tenantPortal.catalog.remove")}
                  </Button>
                </div>
                {product?.price != null ? (
                  <p className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {t("tenantPortal.catalog.unitPrice", {
                      price:
                        formatCatalogMoney(
                          product.price,
                          product.currency,
                          i18n.language,
                        ) ?? "",
                    })}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      aria-label={t("tenantPortal.catalog.quantityDecrease")}
                      disabled={item.quantity <= CATALOG_CART_MIN_QUANTITY}
                      onClick={() => {
                        cart.update(
                          item.productId,
                          clampCatalogQuantity(item.quantity - 1),
                        )
                      }}
                    >
                      <Minus aria-hidden />
                    </Button>
                    <CatalogQuantityField
                      className="h-11 w-16 px-1 text-center tabular-nums"
                      quantity={item.quantity}
                      productName={product?.name ?? item.productId}
                      onCommit={(next) => {
                        cart.update(item.productId, next)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      aria-label={t("tenantPortal.catalog.quantityIncrease")}
                      disabled={item.quantity >= CATALOG_CART_MAX_QUANTITY}
                      onClick={() => {
                        cart.update(
                          item.productId,
                          clampCatalogQuantity(item.quantity + 1),
                        )
                      }}
                    >
                      <Plus aria-hidden />
                    </Button>
                  </div>
                  <p className="whitespace-nowrap text-muted-foreground tabular-nums">
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
              </li>
            )
          })}
        </ul>
      )}

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
                <FormItem ref={noteGroupRef}>
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
            <div ref={setSubmitBar} className="portal-purchase-submit-bar fixed inset-x-0 bottom-0 z-30 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-3 border-t border-border bg-background px-4 pt-3 md:static md:z-auto md:pb-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
              <p className="text-base font-semibold text-foreground tabular-nums">
                {t("tenantPortal.catalog.cartTotal")}: {cartTotalLabel}
              </p>
              <FormPrimaryButton
                type="submit"
                className="h-11 w-full"
                isValid={isCheckoutValid}
                loading={submitting}
                preserveLoadingLayout
                disabled={cart.items.length === 0}
                loadingLabel={t("tenantPortal.catalog.submitting")}
                style={{ backgroundColor: primary }}
              >
                {t("tenantPortal.catalog.submitOrder")}
              </FormPrimaryButton>
            </div>
          </form>
        </Form>
      ) : null}
    </div>
  )
}
