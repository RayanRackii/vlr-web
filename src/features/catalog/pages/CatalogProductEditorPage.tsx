import "../components/catalogProductEditor.css"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { EntityPage, type EntityTab } from "@/components/layout/EntityPage"
import { AccessDeniedPage } from "@/components/layout/AccessDeniedPage"
import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { AdvancedCard } from "@/components/ui/advanced-card"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  catalogProductFormSchema,
  type CatalogFileVisibility,
  type CatalogProduct,
  type CatalogProductFormValues,
} from "@/features/catalog/schemas/catalogSchemas"
import { CatalogProductAccessSection, CatalogProductAccessHistoryView, type CatalogProductAccessSectionHandle } from "@/features/catalog/components/CatalogProductAccessSection"
import { CatalogProductImageGallery } from "@/features/catalog/components/CatalogProductImageGallery"
import { CatalogProductResourceRequirements } from "@/features/catalog/components/CatalogProductResourceRequirements"
import { catalogFileRejection } from "@/features/catalog/lib/catalogFileRules"
import { selectCatalogProductImages } from "@/features/catalog/lib/selectCatalogProductImages"
import { toCatalogProductWriteBody } from "@/features/catalog/lib/createCatalogProductWithFiles"
import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  deleteCatalogProductFile,
  getCatalogProduct,
  getCatalogProductFileUrl,
  updateCatalogProduct,
  uploadCatalogProductFile,
} from "@/features/catalog/services/catalogService"
import { TaxonomyAssignmentFields } from "@/features/taxonomy/components/TaxonomyAssignmentFields"
import type { TaxonomyOptions } from "@/features/taxonomy/schemas/taxonomySchemas"
import { getCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"

const PRODUCTS_PATH = "/catalogo/produtos"
const MAX_PREVIEW_REFRESH_ATTEMPTS = 2
const CUSTOMER_VISIBLE_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
const INTERNAL_FILE_ACCEPT = ".pdf,.stl,.step,.stp,.dxf,application/pdf"

function productToForm(product: CatalogProduct): CatalogProductFormValues {
  return {
    name: product.name,
    code: product.code ?? "",
    description: product.description ?? "",
    price: product.price == null ? "" : String(product.price),
    currency: product.currency,
    ...(product.taxonomy
      ? {
          taxonomy: {
            categoryIds: product.taxonomy.categories.map((item) => item.id),
            tagIds: product.taxonomy.tags.map((item) => item.id),
          },
        }
      : {}),
  }
}

export function CatalogProductEditorPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { can, activeModules } = usePermissions()
  const canManage = can("catalog.products.manage")
  const resourcePlanningActive = activeModules.includes("resource-planning")

  const [product, setProduct] = useState<CatalogProduct | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyOptions>({ categories: [], tags: [] })
  const [saving, setSaving] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [tab, setTab] = useState("dados")
  const [uploadVisibility, setUploadVisibility] = useState<CatalogFileVisibility>("CustomerVisible")
  const [fileBusy, setFileBusy] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [accessDirty, setAccessDirty] = useState(false)
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string>>({})
  const [previewFailures, setPreviewFailures] = useState<Record<string, boolean>>({})
  const [previewRevision, setPreviewRevision] = useState(0)
  // Bounded signed-preview refresh keyed by URL (not by file): a freshly signed
  // URL that later expires can be refreshed again, and a failed refresh may be
  // retried until MAX_PREVIEW_REFRESH_ATTEMPTS is reached for that URL.
  const previewRefreshAttempts = useRef(new Map<string, { attempts: number; pending: boolean }>())
  // Pending backoff timers for failed refreshes, cleared on unmount/file change.
  const previewRefreshTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
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
      form.reset(productToForm(next))
    },
    [form],
  )

  // Re-sign an expired preview URL for a file, counting each try against the
  // per-URL budget. A broken gallery emits no second error event, so a failed
  // signing request reschedules itself with a small linear backoff until the
  // budget is exhausted.
  const refreshSignedPreview = useCallback(
    function retryPreview(source: string, productId: string, fileId: string, maxAttempts = MAX_PREVIEW_REFRESH_ATTEMPTS) {
      const refresh = previewRefreshAttempts.current.get(source) ?? { attempts: 0, pending: false }
      if (refresh.pending || refresh.attempts >= maxAttempts) return
      refresh.attempts += 1
      refresh.pending = true
      previewRefreshAttempts.current.set(source, refresh)
      void getCatalogProductFileUrl(productId, fileId)
        .then(({ url }) => {
          if (previewRefreshAttempts.current.get(source) !== refresh) return
          if (!url.trim()) throw new Error("Empty preview URL")
          refresh.pending = false
          setSignedImageUrls((current) => ({ ...current, [`${productId}:${fileId}`]: url }))
          // Re-signing may return the same URL; still reset the gallery's failed image.
          setPreviewRevision((current) => current + 1)
        })
        .catch(() => {
          if (previewRefreshAttempts.current.get(source) !== refresh) return
          if (refresh.attempts >= maxAttempts) {
            refresh.pending = false
            setPreviewFailures((current) => ({ ...current, [`${productId}:${fileId}`]: true }))
            return
          }
          const timer = setTimeout(() => {
            previewRefreshTimers.current.delete(timer)
            refresh.pending = false
            retryPreview(source, productId, fileId, maxAttempts)
          }, 500 * refresh.attempts)
          previewRefreshTimers.current.add(timer)
        })
    },
    [],
  )

  useEffect(() => {
    const timers = previewRefreshTimers.current
    const attempts = previewRefreshAttempts.current
    return () => {
      attempts.clear()
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [id])

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

  useEffect(() => {
    void getCatalogTaxonomyOptions()
      .then(setTaxonomyOptions)
      .catch(() => setTaxonomyOptions({ categories: [], tags: [] }))
  }, [])

  useEffect(() => {
    if (!product) return
    const candidates = selectCatalogProductImages(
      product.files
        .filter((file) => file.status !== "Pending" && file.status !== "Failed" && !file.url?.trim() && !signedImageUrls[`${product.id}:${file.id}`])
        .map((file) => ({ ...file, url: "pending" })),
    )
    for (const file of candidates) {
      refreshSignedPreview(`initial:${product.id}:${file.id}`, product.id, file.id, 3)
    }
  }, [product, signedImageUrls, refreshSignedPreview])

  const reload = useCallback(async ({ filesOnly = false } = {}) => {
    if (!id) return
    try {
      const next = await getCatalogProduct(id)
      setProduct((current) => current ? {
        ...current, files: next.files, hasFiles: next.hasFiles,
        ...(filesOnly ? {} : { isActive: next.isActive, visibility: next.visibility }),
      } : next)
      const keys = new Set(next.files.map((file) => `${next.id}:${file.id}`))
      setSignedImageUrls((current) => Object.fromEntries(Object.entries(current).filter(([key]) => keys.has(key))))
      // File set changed (upload/delete); reset the per-URL refresh budget and
      // drop any pending backoff retries that target the old URLs.
      previewRefreshAttempts.current.clear()
      previewRefreshTimers.current.forEach(clearTimeout)
      previewRefreshTimers.current.clear()
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
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.saveCatalogProduct"),
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive() {
    if (!product || !canManage) return
    if (
      product.isActive &&
      !window.confirm(t("catalog.products.deactivateConfirmBody", { name: product.name }))
    ) {
      return
    }
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

  function describeFileRejection(file: File): string | null {
    const rejection = catalogFileRejection(file, uploadVisibility)
    if (rejection == null) return null
    return t(`catalog.products.files.${rejection}`, { name: file.name })
  }

  async function onUploadFile(file: File | undefined) {
    if (!file || !product) return
    const rejection = describeFileRejection(file)
    if (rejection != null) {
      setFileError(rejection)
      return
    }
    setFileBusy(true)
    setFileError(null)
    try {
      await uploadCatalogProductFile(product.id, file, uploadVisibility)
      await reload()
      toast.success(t("catalog.products.toastFileUploaded"))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("apiErrors.uploadCatalogFile")
      setFileError(message)
      toast.error(message)
      await reload({ filesOnly: true })
    } finally {
      setFileBusy(false)
    }
  }

  async function onDeleteFile(fileId: string) {
    if (!product) return
    setFileBusy(true)
    try {
      await deleteCatalogProductFile(product.id, fileId)
      await reload()
      toast.success(t("catalog.products.toastFileDeleted"))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.deleteCatalogFile"),
      )
    } finally {
      setFileBusy(false)
    }
  }

  async function onOpenFile(fileId: string) {
    if (!product) return
    try {
      const result = await getCatalogProductFileUrl(product.id, fileId)
      window.open(result.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("apiErrors.loadCatalogFileUrl"),
      )
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

  const formDirty = form.formState.isDirty
  const isFormValid = catalogProductFormSchema.safeParse(watchedValues).success
  // Keep the save/discard bar visible whenever there are changes, even if a
  // field is invalid, so Descartar stays reachable; Save is disabled instead.
  const dirty = canManage && (formDirty || accessDirty)
  const unsavedCount = (formDirty ? 1 : 0) + (accessDirty ? 1 : 0)
  const fieldsLocked = !canManage || saving
  const previewImages = selectCatalogProductImages(
    product.files.filter((file) => file.status !== "Pending" && file.status !== "Failed").map((file) => ({
      ...file,
      url: signedImageUrls[`${product.id}:${file.id}`] || file.url?.trim(),
    })),
  )

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
        <section className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">{t("taxonomy.assignment")}</p>
          <TaxonomyAssignmentFields
            control={form.control}
            options={taxonomyOptions}
            disabled={fieldsLocked}
          />
        </section>
        {canManage && resourcePlanningActive ? (
          <AdvancedCard>
            <CatalogProductResourceRequirements productId={product.id} />
          </AdvancedCard>
        ) : null}
      </div>
    ),
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
      <div className="min-w-0 w-full max-w-xl space-y-3" onErrorCapture={(event) => {
        if (!(event.target instanceof HTMLImageElement)) return
        const source = event.target.getAttribute("src")
        if (!source) return
        const image = previewImages.find((item) => item.url === source)
        if (!image) return
        refreshSignedPreview(source, product.id, image.id)
        setPreviewFailures((current) => ({ ...current, [`${product.id}:${image.id}`]: true }))
      }} onLoadCapture={(event) => {
        if (!(event.target instanceof HTMLImageElement)) return
        const source = event.target.getAttribute("src")
        const image = previewImages.find((item) => item.url === source)
        if (!image) return
        setPreviewFailures((current) => ({ ...current, [`${product.id}:${image.id}`]: false }))
      }}>
        {previewImages.length > 0 ? (
          <CatalogProductImageGallery
            key={`${previewRevision}:${previewImages.map((image) => image.url).join("|")}`}
            images={previewImages}
            alt={product.name}
            frameClassName="h-40 w-full rounded-lg"
          />
        ) : null}
        {product.files.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {product.files.map((file) => (
              <li key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 max-w-full">
                  <span className="block truncate">
                    {file.fileName}{" "}
                    <Badge variant="outline">
                      {file.visibility === "CustomerVisible"
                        ? t("catalog.products.files.customerVisible")
                        : t("catalog.products.files.internal")}
                    </Badge>
                  </span>
                  {file.status === "Pending" || file.status === "Failed" ? (
                    <p className="text-sm text-destructive">
                      {t(file.status === "Pending" ? "catalog.products.files.pendingRecord" : "catalog.products.files.failedRecord")}
                    </p>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {file.status !== "Pending" && file.status !== "Failed" ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void onOpenFile(file.id)}>
                      {t("catalog.products.files.open")}
                    </Button>
                  ) : null}
                  {file.status !== "Pending" && file.status !== "Failed" && previewFailures[`${product.id}:${file.id}`] ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      const source = `manual:${product.id}:${file.id}`
                      previewRefreshAttempts.current.delete(source)
                      refreshSignedPreview(source, product.id, file.id, 3)
                    }}>
                      {t("catalog.products.files.retry")}
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={fileBusy}
                      onClick={() => void onDeleteFile(file.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("catalog.products.files.empty")}</p>
        )}
        {canManage ? (
          <div className="flex min-w-0 w-full flex-wrap gap-2">
            <div className="min-w-0 max-w-full space-y-1">
              <span className="block text-sm font-medium">
                {t("catalog.products.files.whoSees")}
              </span>
              <SegmentedControl
                className="min-w-0 max-w-full flex-wrap"
                label={t("catalog.products.files.whoSees")}
                value={uploadVisibility}
                disabled={fileBusy}
                onChange={setUploadVisibility}
                options={[
                  { value: "CustomerVisible", label: t("catalog.products.files.customerShort") },
                  { value: "InternalB2B", label: t("catalog.products.files.internalShort") },
                ]}
              />
            </div>
            <div className="min-w-0 basis-64 flex-1 space-y-1">
              <label htmlFor="catalog-product-file-input" className="text-sm font-medium">
                {t("catalog.products.files.select")}
              </label>
              <Input
                className="min-w-0 w-full max-w-full"
                id="catalog-product-file-input"
                type="file"
                disabled={fileBusy}
                accept={
                  uploadVisibility === "CustomerVisible"
                    ? CUSTOMER_VISIBLE_FILE_ACCEPT
                    : INTERNAL_FILE_ACCEPT
                }
                onChange={(event) => {
                  void onUploadFile(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
            </div>
          </div>
        ) : null}
        {fileError !== null ? (
          <p role="alert" className="text-sm text-destructive">
            {fileError}
          </p>
        ) : null}
      </div>
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
      <EntityPage
        className={`catalog-product-editor min-w-0 ${tab === "access" ? "pb-0" : ""}`}
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="breadcrumb">
            <span>{t("catalog.products.editor.breadcrumbRoot")}</span>
            <span aria-hidden>›</span>
            <Link to={PRODUCTS_PATH} className="hover:text-foreground">
              {t("catalog.products.title")}
            </Link>
            <span aria-hidden>›</span>
            <span className="text-foreground">{product.name}</span>
          </nav>
        }
        title={product.name}
        badges={
          <>
            <Badge variant={product.isActive ? "secondary" : "outline"}>
              {product.isActive
                ? t("catalog.products.active")
                : t("catalog.products.inactive")}
            </Badge>
            {(product.visibility ?? "Public") === "Restricted" ? (
              <Badge variant="outline">{t("catalog.products.visibilityFilter.restricted")}</Badge>
            ) : null}
          </>
        }
        tabs={[dadosTab, priceTab, filesTab, accessTab, historyTab]}
        value={tab}
        onValueChange={setTab}
        dirty={dirty}
        saveDisabled={!isFormValid}
        unsavedCount={unsavedCount}
        onSave={canManage ? () => void form.handleSubmit(onSubmit)() : undefined}
        onDiscard={canManage ? () => {
          form.reset(productToForm(product))
          accessSectionRef.current?.reset()
        } : undefined}
        saving={saving}
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
    </Form>
  )
}
