import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Copy, Pencil, Power, Settings, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { RowActionsMenu, type RowActionItem } from "@/components/data-table/RowActionsMenu"
import { Page } from "@/components/layout/Page"
import { useBreadcrumbTitle } from "@/components/layout/useBreadcrumbTitle"
import { ErrorState } from "@/components/ErrorState"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/ui/status"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { ProductHistoryTab } from "@/features/catalog/components/productView/ProductHistoryTab"
import { ProductViewGallery } from "@/features/catalog/components/productView/ProductViewGallery"
import { QueueSummary } from "@/features/catalog/components/ProductScheduleSection"
import { useProductWizard } from "@/features/catalog/components/productWizard/useProductWizard"
import { saleMissingLabels } from "@/features/catalog/lib/catalogApiErrors"
import { productWizardPath } from "@/features/catalog/components/productWizard/wizardSteps"
import { productEditPath, productViewPath } from "@/features/catalog/lib/productEditorPath"
import { selectCatalogProductImages } from "@/features/catalog/lib/selectCatalogProductImages"
import {
  formatCatalogDate,
  formatCatalogMoney,
  type CatalogProductFile,
  type CatalogProductResourceRequirement,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  deleteCatalogProduct,
  duplicateCatalogProduct,
  getCatalogProductFileUrl,
} from "@/features/catalog/services/catalogService"
import { listAdminRentalAssets, type AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { cn } from "@/lib/utils"

const PRODUCTS_PATH = "/catalogo/produtos"
const SHORT_DESCRIPTION_LIMIT = 240

/** First ~240 characters, cut at a word boundary. Null when the text already fits. */
function shortDescription(text: string): string | null {
  if (text.length <= SHORT_DESCRIPTION_LIMIT) return null
  const cut = text.slice(0, SHORT_DESCRIPTION_LIMIT)
  const space = cut.lastIndexOf(" ")
  return `${(space > SHORT_DESCRIPTION_LIMIT / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

function requirementRows(value: unknown): CatalogProductResourceRequirement[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is CatalogProductResourceRequirement => typeof (row as { resourceQuantity?: unknown } | null)?.resourceQuantity === "number")
}

function formatFileSize(bytes: number, locale: string): string {
  if (bytes < 1024) return `${bytes} B`
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
  return bytes < 1024 * 1024 ? `${format(bytes / 1024)} KB` : `${format(bytes / (1024 * 1024))} MB`
}

function fileTypeLabel(file: CatalogProductFile): string {
  const extension = file.fileName.includes(".") ? file.fileName.split(".").pop() : null
  return (extension ?? file.mimeType.split("/").pop() ?? "").toUpperCase()
}

export function ProductViewPage() {
  const { id = "" } = useParams()
  const { t } = useTranslation()
  const wizard = useProductWizard(id)
  useBreadcrumbTitle(wizard.model?.product.name)

  if (wizard.loading) {
    return <Skeleton className="h-96 w-full" role="status" aria-label={t("common.loading")} />
  }
  if (wizard.error || !wizard.model) {
    return (
      <div className="w-full max-w-3xl space-y-4">
        <ErrorState message={wizard.error ?? t("catalog.products.editor.notFound")} onRetry={() => void wizard.reload()} />
        <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to={PRODUCTS_PATH}>
          {t("catalog.products.editor.back")}
        </Link>
      </div>
    )
  }
  return <ProductView wizard={wizard} model={wizard.model} />
}

type Wizard = ReturnType<typeof useProductWizard>
type WizardModel = NonNullable<Wizard["model"]>

function ProductView({ wizard, model }: { wizard: Wizard; model: WizardModel }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const timeZoneId = useTenantTimeZone()
  const { product } = model
  const canManage = wizard.canManage

  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [assets, setAssets] = useState<AdminRentalAsset[]>([])
  const requestedUrls = useRef(new Set<string>())

  const requirements = useMemo(() => requirementRows(model.requirements), [model.requirements])
  const usesAgenda = product.usesSchedule
  const showAgendaData = usesAgenda && wizard.rentalsActive

  useEffect(() => {
    if (!showAgendaData) return
    let active = true
    void listAdminRentalAssets().then((rows) => { if (active) setAssets(rows) }).catch(() => { if (active) setAssets([]) })
    return () => { active = false }
  }, [showAgendaData])

  // Photos may come without a URL: sign them once each.
  useEffect(() => {
    for (const file of product.files) {
      if (file.visibility !== "CustomerVisible" || file.status !== "Ready" || file.url?.trim()) continue
      if (requestedUrls.current.has(file.id)) continue
      requestedUrls.current.add(file.id)
      void getCatalogProductFileUrl(product.id, file.id)
        .then(({ url }) => setSignedUrls((current) => ({ ...current, [file.id]: url })))
        .catch(() => undefined)
    }
  }, [product.files, product.id])

  const images = useMemo(
    () => selectCatalogProductImages(
      product.files
        .filter((file) => file.visibility === "CustomerVisible" && file.status === "Ready")
        .map((file) => ({ ...file, url: file.url?.trim() ? file.url : signedUrls[file.id] ?? null })),
    ),
    [product.files, signedUrls],
  )
  const documents = product.files.filter((file) => file.visibility === "InternalB2B")

  const readiness = product.saleReadiness
  const incomplete = readiness != null && !readiness.ready
  const missingLabels = saleMissingLabels(readiness?.missing ?? [])
  const visibility = model.access?.visibility ?? product.visibility
  const restricted = visibility === "Restricted"
  const categories = product.taxonomy?.categories ?? []
  const tags = product.taxonomy?.tags ?? []
  const description = product.description?.trim() ?? ""
  const price = formatCatalogMoney(product.price, product.currency, i18n.language)
  const linkedAssetIds = requirements.flatMap((row) => (row.rentalAssetId ? [row.rentalAssetId] : []))
  const linkedAssets = assets.filter((asset) => linkedAssetIds.includes(asset.id))
  const assetNames = linkedAssets.map((asset) => asset.name)
  const short = shortDescription(description)

  async function run(action: () => Promise<void>, fallbackKey: string) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(fallbackKey))
    } finally {
      setBusy(false)
    }
  }

  const duplicate = () => run(async () => {
    const copy = await duplicateCatalogProduct(product.id)
    toast.success(t("catalog.products.view.toastDuplicated"))
    void navigate(productViewPath(copy.id))
  }, "catalog.products.view.errors.duplicate")

  const setActive = (next: boolean) => run(async () => {
    if (next) {
      await activateCatalogProduct(product.id)
      toast.success(t("catalog.products.toastActivated"))
    } else {
      await deactivateCatalogProduct(product.id)
      toast.success(t("catalog.products.toastDeactivated"))
    }
    await wizard.reload()
  }, "apiErrors.updateCatalogProductStatus")

  async function confirmDelete() {
    setBusy(true)
    setDeleteError(null)
    try {
      await deleteCatalogProduct(product.id)
      toast.success(t("catalog.products.view.toastDeleted"))
      void navigate(PRODUCTS_PATH)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("catalog.products.view.errors.delete"))
    } finally {
      setBusy(false)
    }
  }

  const menuItems: RowActionItem[] = []
  if (canManage) {
    menuItems.push({ key: "duplicate", label: t("catalog.products.view.duplicate"), icon: Copy, disabled: busy, onSelect: () => void duplicate() })
    if (incomplete && !product.isActive) {
      menuItems.push({
        key: "activate",
        label: t("catalog.products.menuActivate"),
        icon: Power,
        disabled: true,
        hint: missingLabels.length > 0
          ? t("catalog.products.notReady.message", { items: missingLabels.join(", ") })
          : t("catalog.products.menuActivateHint"),
      })
    } else {
      menuItems.push({
        key: "toggle",
        label: t(product.isActive ? "catalog.products.menuDeactivate" : "catalog.products.menuActivate"),
        icon: Power,
        disabled: busy,
        onSelect: () => (product.isActive ? setDeactivateOpen(true) : void setActive(true)),
      })
    }
    menuItems.push({
      key: "delete",
      label: t("catalog.products.view.delete"),
      icon: Trash2,
      tone: "danger",
      separatorBefore: true,
      disabled: busy,
      onSelect: () => { setDeleteError(null); setDeleteOpen(true) },
    })
  }

  const portalLine = !product.isActive
    ? t("catalog.products.view.portalInactive")
    : restricted ? t("catalog.products.view.portalRestricted") : t("catalog.products.view.portalAvailable")

  const tabs: { value: string; label: string; content: ReactNode }[] = [
    {
      value: "overview",
      label: t("catalog.products.view.tabs.overview"),
      content: (
        <OverviewTab
          description={description}
          rows={[
            { label: t("catalog.products.view.overview.code"), value: product.code },
            { label: t("catalog.products.view.overview.category"), value: categories.map((item) => item.name).join(", ") },
            { label: t("catalog.products.view.overview.tags"), value: tags.map((item) => item.name).join(", ") },
            { label: t("catalog.products.view.overview.visibility"), value: t(restricted ? "catalog.products.view.overview.visibilityRestricted" : "catalog.products.view.overview.visibilityPublic") },
            { label: t("catalog.products.view.overview.created"), value: formatCatalogDate(product.createdAt, i18n.language, timeZoneId) },
            { label: t("catalog.products.view.overview.updated"), value: product.updatedAt ? formatCatalogDate(product.updatedAt, i18n.language, timeZoneId) : null },
          ]}
        />
      ),
    },
    {
      value: "operation",
      label: t("catalog.products.view.tabs.operation"),
      content: <OperationTab usesAgenda={usesAgenda} requirements={requirements} assets={assets} linkedAssets={linkedAssets} model={model} />,
    },
    ...(documents.length > 0
      ? [{
        value: "files",
        label: t("catalog.products.view.tabs.files"),
        content: <FilesTab productId={product.id} files={documents} />,
      }]
      : []),
    {
      value: "history",
      label: t("catalog.products.view.tabs.history"),
      content: <ProductHistoryTab productId={product.id} currency={product.currency} />,
    },
  ]

  return (
    <Page
      header={{
        title: t("catalog.products.view.title"),
        actions: (
          <div className="flex w-full items-center gap-2 sm:w-auto" data-testid="product-view-actions">
            {canManage ? (
              <Link
                to={productEditPath(product.id)}
                className={cn(buttonVariants({ variant: "primary" }), "min-h-11 flex-1 sm:flex-none")}
              >
                <Pencil aria-hidden="true" />
                {t("catalog.products.view.edit")}
              </Link>
            ) : null}
            <RowActionsMenu items={menuItems} busy={busy} label={t("catalog.products.view.moreActions")} />
          </div>
        ),
      }}
    >
    <div className="min-w-0 space-y-6" data-testid="product-view">
      <div
        className={cn(
          "grid min-w-0 gap-x-10 gap-y-6",
          "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr]",
        )}
        data-testid="product-view-main"
      >
        <div
          className={cn("order-1 min-w-0 space-y-3 lg:order-none lg:col-start-2 lg:row-start-1")}
          data-testid="product-view-summary-head"
        >
          {!product.isActive || incomplete ? (
            <Alert variant="warning" data-testid="product-view-banner">
              <AlertDescription className="space-y-1">
                <p className="font-medium">{t(product.isActive ? "catalog.products.view.bannerIncomplete" : "catalog.products.view.bannerInactive")}</p>
                {missingLabels.length > 0 ? <p>{t("catalog.products.view.bannerMissing", { items: missingLabels.join(", ") })}</p> : null}
                {canManage && incomplete ? (
                  <Link className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4" to={productWizardPath(product.id)}>
                    <Settings className="mr-1 size-4" aria-hidden="true" />
                    {t("catalog.products.view.completeSetup")}
                  </Link>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={product.isActive ? "success" : "neutral"}>
              {t(product.isActive ? "catalog.products.active" : "catalog.products.inactive")}
            </StatusBadge>
            {incomplete ? <Badge className="border-transparent bg-accent text-accent-foreground">{t("catalog.products.view.statusIncomplete")}</Badge> : null}
          </div>
          <h2 className="break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{product.name}</h2>
          {product.code ? <p className="break-all text-sm text-muted-foreground">{t("catalog.products.view.code", { code: product.code })}</p> : null}
        </div>

        <div className="order-2 min-w-0 lg:order-none lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <ProductViewGallery
            images={images}
            name={product.name}
            addPhotosHref={canManage ? productEditPath(product.id, "arquivos") : undefined}
          />
        </div>

        <div
          className={cn("order-3 min-w-0 space-y-5 lg:order-none lg:col-start-2 lg:row-start-2")}
          data-testid="product-view-summary-body"
        >
          {description ? (
            <div className="space-y-1">
              <p className="whitespace-pre-line break-words text-sm text-muted-foreground" data-testid="product-view-short-description">
                {descriptionOpen || short == null ? description : short}
              </p>
              {short != null ? (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                  aria-expanded={descriptionOpen}
                  onClick={() => setDescriptionOpen((open) => !open)}
                >
                  {t(descriptionOpen ? "catalog.products.view.seeLess" : "catalog.products.view.seeMore")}
                </button>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("catalog.products.view.priceLabel")}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground" data-testid="product-view-price">
              {price ?? t("catalog.products.view.onRequest")}
            </p>
          </div>

          {categories.length > 0 || tags.length > 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              {categories.length > 0 ? <p>{categories.map((item) => item.name).join(" / ")}</p> : null}
              {tags.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => <li key={tag.id} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">{tag.name}</li>)}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm" data-testid="product-view-availability">
            <p className="font-medium text-foreground">
              {usesAgenda
                ? assetNames.length > 0
                  ? t("catalog.products.view.usesAgendaWith", { resources: assetNames.join(", ") })
                  : t("catalog.products.view.usesAgenda")
                : t("catalog.products.view.noAgenda")}
            </p>
            {usesAgenda && can("catalog.orders.read") ? (
              <Link
                className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
                to={`/agendas/produto?produto=${encodeURIComponent(product.id)}`}
              >
                {t("catalog.products.view.seeAgenda")}
              </Link>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground" data-testid="product-view-portal">{portalLine}</p>

        </div>
      </div>

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList variant="line">
          {tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="min-w-0 pt-4">{tab.content}</TabsContent>
        ))}
      </Tabs>

      <Dialog open={deactivateOpen} onOpenChange={(open) => { if (!busy) setDeactivateOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.products.deactivateConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("catalog.products.deactivateConfirmBody", { name: product.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeactivateOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => { setDeactivateOpen(false); void setActive(false) }}>
              {t("catalog.products.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => { if (!busy) setDeleteOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("catalog.products.view.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("catalog.products.view.deleteBody", { name: product.name })}</DialogDescription>
          </DialogHeader>
          {deleteError != null ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>{t("common.cancel")}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
              {t("catalog.products.view.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Page>
  )
}

function OverviewTab({ description, rows }: { description: string; rows: { label: string; value: string | null | undefined }[] }) {
  const { t } = useTranslation()
  const visibleRows = rows.filter((row) => row.value != null && row.value !== "")
  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {description ? (
        <section className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t("catalog.products.view.overview.about")}</h2>
          <p className="whitespace-pre-line break-words text-sm text-muted-foreground" data-testid="product-view-full-description">{description}</p>
        </section>
      ) : null}
      <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4", !description && "lg:col-span-2 lg:max-w-xl")}>
        <h2 className="mb-3 text-base font-semibold text-foreground">{t("catalog.products.view.overview.info")}</h2>
        <dl className="space-y-2 text-sm">
          {visibleRows.map((row) => (
            <div key={row.label} className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-0.5">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 break-words text-right text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}

function OperationTab({ usesAgenda, requirements, assets, linkedAssets, model }: {
  usesAgenda: boolean
  requirements: readonly CatalogProductResourceRequirement[]
  assets: readonly AdminRentalAsset[]
  linkedAssets: readonly AdminRentalAsset[]
  model: WizardModel
}) {
  const { t } = useTranslation()
  const access = model.access
  const groupNames = (model.groups ?? []).filter((group) => access?.groupIds.includes(group.id)).map((group) => group.name)
  const customerCount = access?.customerIds.length ?? 0
  const restricted = (access?.visibility ?? model.product.visibility) === "Restricted"

  function resourceName(row: CatalogProductResourceRequirement): string {
    if (row.rentalAssetId) return assets.find((asset) => asset.id === row.rentalAssetId)?.name ?? t("catalog.products.view.operation.unknownResource")
    return t("catalog.products.view.operation.resourceCategory")
  }

  return (
    <div className="grid min-w-0 gap-6 lg:max-w-3xl">
      <section className="min-w-0 space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t("catalog.products.view.operation.agenda")}</h2>
        {!usesAgenda ? (
          <p className="text-sm text-muted-foreground">{t("catalog.products.view.operation.notScheduled")}</p>
        ) : requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("catalog.products.view.operation.noResources")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {requirements.map((row, index) => (
              <li key={row.id ?? `${row.rentalAssetId ?? row.assetCategoryId}-${index}`} className="space-y-0.5 px-4 py-3 text-sm">
                <p className="break-words font-medium text-foreground">{resourceName(row)}</p>
                <p className="text-muted-foreground">
                  {[
                    t("catalog.products.view.operation.qty", { count: row.resourceQuantity }),
                    t("catalog.products.view.operation.duration", { count: row.durationMinutesPerUnit }),
                    t("catalog.products.view.operation.prep", { count: row.prepMinutes }),
                    t("catalog.products.view.operation.cleanup", { count: row.cleanupMinutes }),
                  ].join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {usesAgenda && linkedAssets.length > 0 ? (
        <section className="min-w-0 space-y-2">
          <h2 className="text-base font-semibold text-foreground">{t("catalog.products.view.operation.queue")}</h2>
          <QueueSummary assets={linkedAssets} />
        </section>
      ) : null}

      <section className="min-w-0 space-y-2">
        <h2 className="text-base font-semibold text-foreground">{t("catalog.products.view.operation.access")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(restricted ? "catalog.products.view.operation.accessRestricted" : "catalog.products.view.operation.accessPublic")}
        </p>
        {restricted && groupNames.length > 0 ? <p className="break-words text-sm text-foreground">{t("catalog.products.view.operation.groups", { names: groupNames.join(", ") })}</p> : null}
        {restricted && customerCount > 0 ? <p className="text-sm text-foreground">{t("catalog.products.view.operation.customers", { count: customerCount })}</p> : null}
      </section>
    </div>
  )
}

function FilesTab({ productId, files }: { productId: string; files: readonly CatalogProductFile[] }) {
  const { t, i18n } = useTranslation()

  async function open(fileId: string) {
    try {
      const result = await getCatalogProductFileUrl(productId, fileId)
      window.open(result.url, "_blank", "noopener,noreferrer")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("apiErrors.loadCatalogFileUrl"))
    }
  }

  return (
    <section aria-label={t("catalog.products.view.files.title")} className="min-w-0 space-y-2 lg:max-w-3xl">
      <h2 className="text-base font-semibold text-foreground">{t("catalog.products.view.files.title")}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {files.map((file) => (
          <li key={file.id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="break-all font-medium text-foreground">{file.fileName}</p>
              <p className="text-muted-foreground">
                {[fileTypeLabel(file), formatFileSize(file.sizeBytes, i18n.language)].filter(Boolean).join(" · ")}
                {file.status === "Pending" ? ` · ${t("catalog.products.files.pendingRecord")}` : null}
                {file.status === "Failed" ? ` · ${t("catalog.products.files.failedRecord")}` : null}
              </p>
            </div>
            {file.status === "Ready" ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void open(file.id)}>
                {t("catalog.products.view.files.open")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
