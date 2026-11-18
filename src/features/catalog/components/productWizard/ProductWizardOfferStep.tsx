import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProductUsesScheduleField } from "@/features/catalog/components/ProductUsesScheduleField"
import { useStepSubmit } from "@/features/assistant/stepSubmit"
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

/** "dados": name/code/description. "precos": price/currency. "full": today's editor form. */
export type ProductWizardOfferMode = "full" | "dados" | "precos"

type ProductWizardOfferStepProps = {
  product: CatalogProduct
  mode?: ProductWizardOfferMode
  readOnly: boolean
  /** Show the "usa agenda" question (tenant has the rentals module). */
  showUsesSchedule?: boolean
  onSaved: () => void | Promise<void>
  onDirtyChange?: (dirty: boolean) => void
  onSavingChange?: (saving: boolean) => void
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

function sameOfferDraft(left: CatalogProductFormValues, right: CatalogProductFormValues): boolean {
  return left.name === right.name
    && left.code === right.code
    && left.description === right.description
    && left.price === right.price
    && left.currency === right.currency
    && left.usesSchedule === right.usesSchedule
}

export function ProductWizardOfferStep({ product, mode = "full", readOnly, showUsesSchedule = false, onSaved, onDirtyChange, onSavingChange }: ProductWizardOfferStepProps) {
  const { t } = useTranslation()
  const [active, setActive] = useState(product.isActive)
  const [savedActive, setSavedActive] = useState(product.isActive)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const showIdentity = mode !== "precos"
  const showPricing = mode !== "dados"
  const showStatus = mode === "full"
  const form = useForm<CatalogProductFormValues>({
    resolver: zodResolver(catalogProductFormSchema),
    defaultValues: {
      name: product.name,
      code: product.code ?? "",
      description: product.description ?? "",
      price: product.price == null ? "" : String(product.price),
      currency: product.currency || "BRL",
      usesSchedule: product.usesSchedule,
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
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

  async function save(values: CatalogProductFormValues): Promise<boolean> {
    if (readOnly || saving) {
      return false
    }
    const priceTrimmed = values.price.trim()
    let price: number | null = null
    if (priceTrimmed.length > 0) {
      const parsed = Number(priceTrimmed.replace(",", "."))
      if (!Number.isFinite(parsed) || parsed < 0) {
        form.setError("price", { message: t("catalog.products.invalidPrice") })
        return false
      }
      price = parsed
    }
    const activeAtSave = active
    setSaving(true)
    setSaveError(null)
    onSavingChange?.(true)
    try {
      await updateCatalogProduct(product.id, toCatalogProductWriteBody(values, price))
      if (activeAtSave !== product.isActive) {
        if (activeAtSave) {
          await activateCatalogProduct(product.id)
        } else {
          await deactivateCatalogProduct(product.id)
        }
      }
      const current = form.getValues()
      if (sameOfferDraft(current, values) && active === activeAtSave) {
        form.reset(values)
        setSavedActive(activeAtSave)
      }
      toast.success(t("catalog.products.toastUpdated"))
      await onSaved()
      return true
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t("apiErrors.saveCatalogProduct")
      setSaveError(message)
      toast.error(message)
      return false
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  // Inside the cadastro shell the footer saves; the step's own Save button is hidden.
  const shellDrivesSave = useStepSubmit(async () => {
    if (readOnly || !dirty) {
      return true
    }
    const visibleFields = mode === "dados"
      ? (["name", "code", "description", "usesSchedule"] as const)
      : mode === "precos"
        ? (["price", "currency"] as const)
        : undefined
    if (!(await form.trigger(visibleFields ? [...visibleFields] : undefined))) {
      return false
    }
    return save(form.getValues())
  })

  return (
    <Form {...form}>
      <form
        className={shellDrivesSave ? "w-full space-y-4" : "mx-auto w-full max-w-xl space-y-4"}
        onSubmit={form.handleSubmit(async (values) => { await save(values) })}
      >
        {shellDrivesSave ? null : (
          <div>
            <h2 className="text-lg font-semibold">{t("catalog.productWizard.steps.offer")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("catalog.productWizard.offerHint")}</p>
          </div>
        )}
        {showIdentity ? (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(mode === "dados" ? "cadastro.product.nameLabel" : "catalog.products.form.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={readOnly || saving} />
                  </FormControl>
                  {mode === "dados" ? <FormDescription>{t("cadastro.offerNameHelp")}</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(mode === "dados" ? "cadastro.product.codeLabel" : "catalog.products.form.code")}</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={readOnly || saving} />
                  </FormControl>
                  {mode === "dados" ? <FormDescription>{t("cadastro.offerCodeHelp")}</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            {mode === "dados" && showUsesSchedule ? (
              <FormField
                control={form.control}
                name="usesSchedule"
                render={({ field }) => (
                  <FormItem>
                    <ProductUsesScheduleField value={field.value ?? true} onChange={(next) => field.onChange(next)} disabled={readOnly || saving} />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(mode === "dados" ? "cadastro.product.descriptionLabel" : "catalog.products.form.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={mode === "dados" ? 5 : 3}
                      placeholder={mode === "dados" ? t("cadastro.offerDescriptionPlaceholder") : undefined}
                      disabled={readOnly || saving}
                    />
                  </FormControl>
                  {mode === "dados" ? <FormDescription>{t("cadastro.offerDescriptionHelp")}</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}
        {mode === "dados" ? (
          <p className="rounded-lg bg-muted px-3 py-3 text-xs text-muted-foreground">{t("cadastro.offerPricingInfo")}</p>
        ) : null}
        {showPricing ? (
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
        ) : null}
        {showStatus ? (
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
        ) : null}
        {saveError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        ) : null}
        {readOnly || shellDrivesSave ? null : (
          <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={saving || !draftValid} aria-busy={saving}>
            {saving ? t("common.saveStatus.saving") : t("common.save")}
          </Button>
        )}
      </form>
    </Form>
  )
}
