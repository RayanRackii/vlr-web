import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toCatalogProductWriteBody } from "@/features/catalog/lib/createCatalogProductWithFiles"
import {
  catalogProductFormSchema,
  type CatalogProduct,
  type CatalogProductFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"

type ProductWizardOfferStepProps = {
  product: CatalogProduct
  readOnly: boolean
  onSaved: () => void
  onDirtyChange?: (dirty: boolean) => void
}

function offerDraftIsValid(values: {
  name?: string
  code?: string
  description?: string
  price?: string
  currency?: string
}): boolean {
  const price = (values.price ?? "").trim()
  if (!catalogProductFormSchema.safeParse({
    name: values.name ?? "",
    code: values.code ?? "",
    description: values.description ?? "",
    price,
    currency: values.currency ?? "",
  }).success) {
    return false
  }
  if (price.length === 0) {
    return true
  }
  const amount = Number(price.replace(",", "."))
  return Number.isFinite(amount) && amount >= 0
}

export function ProductWizardOfferStep({ product, readOnly, onSaved, onDirtyChange }: ProductWizardOfferStepProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState(product.isActive)
  const [savedActive, setSavedActive] = useState(product.isActive)
  const [saving, setSaving] = useState(false)
  const form = useForm<CatalogProductFormValues>({
    resolver: zodResolver(catalogProductFormSchema),
    defaultValues: {
      name: product.name,
      code: product.code ?? "",
      description: product.description ?? "",
      price: product.price == null ? "" : String(product.price),
      currency: product.currency || "BRL",
      taxonomy: {
        categoryIds: product.taxonomy?.categories.map((category) => category.id) ?? [],
        tagIds: product.taxonomy?.tags.map((tag) => tag.id) ?? [],
      },
    },
  })
  const draft = useWatch({ control: form.control })
  const draftValid = offerDraftIsValid(draft)
  const dirty = form.formState.isDirty || active !== savedActive

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  async function onSubmit(values: CatalogProductFormValues) {
    if (readOnly || saving) {
      return
    }
    const priceTrimmed = values.price.trim()
    let price: number | null = null
    if (priceTrimmed.length > 0) {
      const parsed = Number(priceTrimmed.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        form.setError("price", { message: t("catalog.products.invalidPrice") })
        return
      }
      price = parsed
    }
    setSaving(true)
    try {
      await updateCatalogProduct(product.id, toCatalogProductWriteBody(values, price))
      if (active !== product.isActive) {
        if (active) {
          await activateCatalogProduct(product.id)
        } else {
          await deactivateCatalogProduct(product.id)
        }
      }
      form.reset(values)
      setSavedActive(active)
      toast.success(t("catalog.products.toastUpdated"))
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("apiErrors.saveCatalogProduct"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form className="mx-auto w-full max-w-xl space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <h2 className="text-lg font-semibold">{t("catalog.productWizard.steps.offer")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("catalog.productWizard.offerHint")}</p>
        </div>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.products.form.name")}</FormLabel>
              <FormControl>
                <Input {...field} disabled={readOnly || saving} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.products.form.code")}</FormLabel>
              <FormControl>
                <Input {...field} disabled={readOnly || saving} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.products.form.description")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} disabled={readOnly || saving} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.products.form.price")}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode="decimal" placeholder={t("catalog.priceOnRequest")} disabled={readOnly || saving} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.products.form.currency")}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={3} disabled={readOnly || saving} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <fieldset className="space-y-2" disabled={readOnly || saving}>
          <legend className="text-sm font-medium">{t("catalog.products.columns.status")}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("catalog.products.columns.status")}>
            <Button type="button" variant={active ? "default" : "outline"} className="min-h-11" aria-pressed={active} onClick={() => setActive(true)}>
              {t("catalog.products.active")}
            </Button>
            <Button type="button" variant={active ? "outline" : "default"} className="min-h-11" aria-pressed={!active} onClick={() => setActive(false)}>
              {t("catalog.products.inactive")}
            </Button>
          </div>
        </fieldset>
        {readOnly ? null : (
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving || !draftValid}>
            {t("common.save")}
          </Button>
        )}
      </form>
    </Form>
  )
}
