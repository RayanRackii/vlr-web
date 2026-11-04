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
import { CatalogProductAccessSection, type CatalogProductAccessSectionHandle } from "@/features/catalog/components/CatalogProductAccessSection"
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

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const next = await getCatalogProduct(id)
      applyProduct(next)
    } catch {
      /* keep current values on refetch failure */
    }
  }, [id, applyProduct])

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
      const accessOk = (await accessSectionRef.current?.persist()) ?? true
      if (!accessOk) {
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
  const dirty = canManage && isFormValid && (formDirty || accessDirty)
  const unsavedCount = (formDirty ? 1 : 0) + (accessDirty ? 1 : 0)
  const fieldsLocked = !canManage || saving
  const previewImages = selectCatalogProductImages(product.files)

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
      <div className="max-w-xl space-y-3">
        {previewImages.length > 0 ? (
          <CatalogProductImageGallery
            images={previewImages}
            alt={product.name}
            frameClassName="h-40 w-full rounded-lg"
          />
        ) : null}
        {product.files.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {product.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 max-w-full truncate">
                  {file.fileName}{" "}
                  <Badge variant="outline">
                    {file.visibility === "CustomerVisible"
                      ? t("catalog.products.files.customerVisible")
                      : t("catalog.products.files.internal")}
                  </Badge>
                </span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void onOpenFile(file.id)}>
                    {t("catalog.products.files.open")}
                  </Button>
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
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-end">
            <div className="space-y-1">
              <span className="block text-sm font-medium">
                {t("catalog.products.files.whoSees")}
              </span>
              <SegmentedControl
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
            <div className="min-w-0 flex-1 space-y-1">
              <label htmlFor="catalog-product-file-input" className="text-sm font-medium">
                {t("catalog.products.files.select")}
              </label>
              <Input
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
    content: (
      <CatalogProductAccessSection
        key={product.id}
        ref={accessSectionRef}
        productId={product.id}
        canManage={canManage}
        canSearchCustomers={can("core.customers.read")}
        onDirtyChange={setAccessDirty}
      />
    ),
  }

  return (
    <Form {...form}>
      <EntityPage
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
        tabs={[dadosTab, priceTab, filesTab, accessTab]}
        value={tab}
        onValueChange={setTab}
        dirty={dirty}
        unsavedCount={unsavedCount}
        onSave={canManage ? () => void form.handleSubmit(onSubmit)() : undefined}
        onDiscard={canManage ? () => form.reset(productToForm(product)) : undefined}
        saving={saving}
        saveLabel={t("catalog.products.save")}
      />
    </Form>
  )
}
