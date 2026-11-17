import "../components/catalogProductEditor.css"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EntityPage, type EntityTab } from "@/components/layout/EntityPage"
import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { CadastroTaxonomyStep } from "@/features/assistant/CadastroTaxonomyStep"
import { UnsavedChangesGuard } from "@/components/layout/UnsavedChangesGuard"
import { ProductScheduleSection } from "@/features/catalog/components/ProductScheduleSection"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { productWizardPath } from "@/features/catalog/components/productWizard/wizardSteps"
import { isProductEditorTab } from "@/features/catalog/lib/productEditorPath"
import { productSetupFromModel } from "@/features/catalog/lib/productSetupStatus"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  catalogProductFormSchema,
  type CatalogProduct,
  type CatalogProductFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import { CatalogProductAccessSection, CatalogProductAccessHistoryView, type CatalogProductAccessSectionHandle } from "@/features/catalog/components/CatalogProductAccessSection"
import { ProductFilesManager } from "@/features/catalog/components/ProductFilesManager"
import { ProductUsesScheduleField } from "@/features/catalog/components/ProductUsesScheduleField"
import { toCatalogProductWriteBody } from "@/features/catalog/lib/createCatalogProductWithFiles"
import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  getCatalogProduct,
  updateCatalogProduct,
} from "@/features/catalog/services/catalogService"

const PRODUCTS_PATH = "/catalogo/produtos"

/** Editable price text with two decimals in the UI locale ("45,50"), no symbol or grouping so it parses back on save. */
function formatPriceInput(price: number | null | undefined, locale: string): string {
  if (price == null) return ""
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(price)
}

function productToForm(product: CatalogProduct, locale: string): CatalogProductFormValues {
  return {
    name: product.name,
    code: product.code ?? "",
    description: product.description ?? "",
    price: formatPriceInput(product.price, locale),
    currency: product.currency,
    usesSchedule: product.usesSchedule,
  }
}

export function CatalogProductEditorPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canManage = can("catalog.products.manage")

  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<string>(() => {
    const requested = searchParams.get("aba")
    return isProductEditorTab(requested) ? requested : "dados"
  })
  const [taxonomyDirty, setTaxonomyDirty] = useState(false)
  const [agendaDirty, setAgendaDirty] = useState(false)
  const [stepSaving, setStepSaving] = useState(false)
  const wizard = useProductWizard(id ?? "")
  const [accessDirty, setAccessDirty] = useState(false)
  const accessSectionRef = useRef<CatalogProductAccessSectionHandle>(null)

  const form = useForm<CatalogProductFormValues>({
    resolver: zodResolver(catalogProductFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      price: "",
      currency: "BRL",
    },
  })

  const watchedValues = useWatch({ control: form.control })

  const applyProduct = useCallback(
    (next: CatalogProduct) => {
      setProduct(next)
      form.reset(productToForm(next, i18n.language))
    },
    [form, i18n.language],
  )

  useEffect(() => {
    if (!id) {
      void navigate(PRODUCTS_PATH, { replace: true })
      return
    }
    let active = true
    getCatalogProduct(id)
      .then((next) => {
        if (!active) return
        applyProduct(next)
        setLoadError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setLoadError(
          error instanceof Error ? error.message : t("apiErrors.loadCatalogProducts"),
        )
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, navigate, t, applyProduct])

  const reload = useCallback(async ({ filesOnly = false } = {}) => {
    if (!id) return
    try {
      const next = await getCatalogProduct(id)
      setProduct((current) => current ? {
        ...current, files: next.files, hasFiles: next.hasFiles,
        taxonomy: next.taxonomy,
        ...(filesOnly ? {} : { isActive: next.isActive, visibility: next.visibility }),
      } : next)
    } catch {
      /* keep current values on refetch failure */
    }
  }, [id])

  async function onSubmit(values: CatalogProductFormValues) {
    if (!product) return
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

    const body = toCatalogProductWriteBody(values, price)
    // Categories and tags are saved by their own section; keep the stored ones on this save.
    if (product.taxonomy) {
      body.taxonomy = {
        categoryIds: product.taxonomy.categories.map((item) => item.id),
        tagIds: product.taxonomy.tags.map((item) => item.id),
      }
    }
    setSaving(true)
    try {
      const updated = await updateCatalogProduct(product.id, body)
      applyProduct(updated)
      const accessOk = accessSectionRef.current ? await accessSectionRef.current.persist() : !accessDirty
      if (!accessOk) {
        toast.error(t("catalog.products.editor.accessSaveFailed"))
        await reload()
        return
      }
      toast.success(t("catalog.products.toastUpdated"))
      await reload()
      void wizard.reload()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.saveCatalogProduct"),
      )
    } finally {
      setSaving(false)
    }
  }

  function toggleActive() {
    if (!product || !canManage) return
    if (product.isActive) {
      setDeactivateOpen(true)
      return
    }
    void commitActiveChange()
  }

  async function commitActiveChange() {
    if (!product || !canManage) return
    setDeactivateOpen(false)
    setStatusBusy(true)
    try {
      if (product.isActive) {
        await deactivateCatalogProduct(product.id)
        toast.success(t("catalog.products.toastDeactivated"))
      } else {
        await activateCatalogProduct(product.id)
        toast.success(t("catalog.products.toastActivated"))
      }
      await reload()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.updateCatalogProductStatus"),
      )
    } finally {
      setStatusBusy(false)
    }
  }

  if (!canManage && !can("catalog.products.read")) {
    return <AccessDeniedPage />
  }

  if (isLoading) {
    return <PageContentSkeleton rows={4} />
  }

  if (loadError || !product) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {loadError ?? t("catalog.products.editor.notFound")}
          </AlertDescription>
        </Alert>
        <Link to={PRODUCTS_PATH} className="text-sm font-medium text-primary hover:underline">
          {t("catalog.products.editor.back")}
        </Link>
      </div>
    )
  }

  const setup = wizard.model ? productSetupFromModel(wizard.model, wizard.rentalsActive) : null
  const showAgenda = product.usesSchedule && (wizard.rentalsActive || (setup?.linkedAssetIds.length ?? 0) > 0)
  const missingCount = setup?.missingCount ?? 0
  const formDirty = form.formState.isDirty
  const isFormValid = catalogProductFormSchema.safeParse(watchedValues).success
  // Keep the save/discard bar visible whenever there are changes, even if a
  // field is invalid, so Descartar stays reachable; Save is disabled instead.
  const dirty = canManage && (formDirty || accessDirty)
  const unsavedCount = (formDirty ? 1 : 0) + (accessDirty ? 1 : 0)
  const fieldsLocked = !canManage || saving
  const dadosTab: EntityTab = {
    value: "dados",
    label: t("catalog.products.tabs.dados"),
    content: (
      <div className="max-w-xl space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.products.form.name")}</FormLabel>
              <FormControl>
                <Input autoComplete="off" disabled={fieldsLocked} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {wizard.rentalsActive ? (
          <FormField
            control={form.control}
            name="usesSchedule"
            render={({ field }) => (
              <FormItem>
                <ProductUsesScheduleField value={field.value ?? true} onChange={(next) => field.onChange(next)} disabled={fieldsLocked} />
              </FormItem>
            )}
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("catalog.products.form.code")}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" disabled={fieldsLocked} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="space-y-2">
            <span className="block text-sm font-medium">
              {t("catalog.products.columns.status")}
            </span>
            <SegmentedControl
              label={t("catalog.products.columns.status")}
              value={product.isActive ? "active" : "inactive"}
              disabled={!canManage || statusBusy}
              onChange={(next) => {
                if ((next === "active") !== product.isActive) {
                  void toggleActive()
                }
              }}
              options={[
                { value: "active", label: t("catalog.products.active") },
                { value: "inactive", label: t("catalog.products.inactive") },
              ]}
            />
          </div>
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.products.form.description")}</FormLabel>
              <FormControl>
                <Textarea rows={3} disabled={fieldsLocked} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <section className="rounded-lg border border-border p-3">
          <CadastroTaxonomyStep
            key={product.id}
            product={product}
            canAssign={canManage}
            onDirtyChange={setTaxonomyDirty}
            onSavingChange={setStepSaving}
            onSaved={() => reload({ filesOnly: true })}
          />
        </section>
      </div>
    ),
    keepMounted: true,
  }

  const agendaTab: EntityTab = {
    value: "agenda",
    label: t("catalog.products.tabs.agenda"),
    content: (
      <ProductScheduleSection
        productId={product.id}
        linkedAssetIds={setup?.linkedAssetIds ?? []}
        readOnly={!wizard.canManage}
        onDirtyChange={setAgendaDirty}
        onSavingChange={setStepSaving}
        onSaved={() => wizard.reload()}
      />
    ),
    keepMounted: true,
  }

  const priceTab: EntityTab = {
    value: "price",
    label: t("catalog.products.tabs.price"),
    content: (
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("catalog.products.form.price")}</FormLabel>
              <FormControl>
                <Input
                  className="tabular-nums"
                  inputMode="decimal"
                  placeholder={t("catalog.priceOnRequest")}
                  disabled={fieldsLocked}
                  {...field}
                />
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
                <Input maxLength={3} disabled={fieldsLocked} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    ),
  }

  const filesTab: EntityTab = {
    value: "files",
    label: t("catalog.products.files.title"),
    badge: product.files.length,
    content: (
      <ProductFilesManager productId={product.id} productName={product.name} files={product.files} canManage={canManage} onReload={reload} />
    ),
  }

  const accessTab: EntityTab = {
    value: "access",
    label: t("catalog.products.tabs.access"),
    content: null,
  }

  const historyTab: EntityTab = {
    value: "history",
    label: t("catalog.products.tabs.history"),
    content: <CatalogProductAccessHistoryView productId={product.id} />,
  }

  return (
    <Form {...form}>
      <UnsavedChangesGuard when={taxonomyDirty || agendaDirty} />
      <EntityPage
        className={`catalog-product-editor min-w-0 ${tab === "access" ? "pb-0" : ""}`}
        title={product.name}
        notice={missingCount > 0 ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
          >
            <span>{t("catalog.products.editor.incomplete", { count: missingCount })}</span>
            <Button
              variant="default"
              className="min-h-11"
              render={<Link to={productWizardPath(product.id)} />}
            >
              {t("catalog.products.editor.continueSetup")}
            </Button>
          </div>
        ) : null}
        badges={
          <>
            {missingCount > 0 ? (
              <Badge className="border-transparent bg-accent text-accent-foreground">
                {t("catalog.products.editor.incomplete", { count: missingCount })}
              </Badge>
            ) : (
              <Badge variant={product.isActive ? "secondary" : "outline"}>
                {product.isActive
                  ? t("catalog.products.active")
                  : t("catalog.products.inactive")}
              </Badge>
            )}
            {(product.visibility ?? "Public") === "Restricted" ? (
              <Badge variant="outline">{t("catalog.products.visibilityFilter.restricted")}</Badge>
            ) : null}
          </>
        }
        wrapTabs
        tabs={[dadosTab, priceTab, ...(showAgenda ? [agendaTab] : []), accessTab, filesTab, historyTab]}
        value={!showAgenda && tab === "agenda" ? "dados" : tab}
        onValueChange={setTab}
        dirty={dirty}
        saveDisabled={!isFormValid}
        unsavedCount={unsavedCount}
        onSave={canManage ? () => void form.handleSubmit(onSubmit)() : undefined}
        onDiscard={canManage ? () => {
          form.reset(productToForm(product, i18n.language))
          accessSectionRef.current?.reset()
        } : undefined}
        saving={saving || stepSaving}
        saveLabel={t("catalog.products.save")}
      />
      <div hidden={tab !== "access"} className="pb-24">
      <CatalogProductAccessSection
        key={product.id}
        ref={accessSectionRef}
        productId={product.id}
        canManage={canManage}
        canSearchCustomers={can("core.customers.read")}
        onDirtyChange={setAccessDirty}
      />
      </div>
      <Dialog
        open={deactivateOpen}
        onOpenChange={(open) => {
          if (!statusBusy) setDeactivateOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.products.deactivateConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("catalog.products.deactivateConfirmBody", { name: product.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeactivateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void commitActiveChange()}>
              {t("catalog.products.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  )
}
