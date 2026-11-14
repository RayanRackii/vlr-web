import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Package, Pencil, Plus, Power, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import type { EmptyStateProps } from "@/components/ui/empty-state"
import { SegmentedControl } from "@/components/ui/segmented-control"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Can } from "@/features/users/permissions/Can"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  formatCatalogMoney,
  type CatalogProduct,
  type ProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import { catalogMenuIsActive } from "@/features/catalog/components/productWizard/sellableChecklist"
import { productWizardPath } from "@/features/catalog/components/productWizard/wizardSteps"
import { ItemStatusBadge } from "@/features/assistant/ItemStatusBadge"
import { productItemStatus } from "@/features/assistant/itemStatus"
import { CatalogEmptyState, CatalogHeading, CatalogTabs } from "@/features/catalog/components/StaffCatalogChrome"
import {
  activateCatalogProduct,
  deactivateCatalogProduct,
  getCatalogProductResourceRequirements,
  listCatalogProducts,
  listProductRequests,
} from "@/features/catalog/services/catalogService"
import { listTenantModuleMenuItems } from "@/features/tenantPortal/services/tenantPortalService"
import { taxonomyQueryFromSearch, setTaxonomySearchParams } from "@/features/taxonomy/lib/taxonomyQuery"
import type { TaxonomyOptions } from "@/features/taxonomy/schemas/taxonomySchemas"
import { getCatalogTaxonomyOptions } from "@/features/taxonomy/services/taxonomyService"

const ProductSetupContext = createContext<{
  menuPublished: boolean | null
  linked: Readonly<Record<string, boolean>>
  rentals: boolean
}>({ menuPublished: null, linked: {}, rentals: false })

export function CatalogProductsPage({ view = "products" }: { view?: "products" | "requests" }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { can, activeModules } = usePermissions()
  const rentals = activeModules.includes("rentals")
  const canReadMenu = can("core.module_menu.read")
  const [catalogMenu, setCatalogMenu] = useState<boolean | null>(null)
  const [linked, setLinked] = useState<Record<string, boolean>>({})

  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [requests, setRequests] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all")
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyOptions>({ categories: [], tags: [] })
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get("category")
  const tagsParam = searchParams.get("tags")
  const taxonomyFilter = useMemo(() => {
    const query = taxonomyQueryFromSearch(new URLSearchParams({
      ...(categoryParam == null ? {} : { category: categoryParam }),
      ...(tagsParam == null ? {} : { tags: tagsParam }),
    }))
    return {
      categoryId: query.category ?? null,
      tagIds: [...(query.tags ?? [])],
    }
  }, [categoryParam, tagsParam])

  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [productPendingDeactivate, setProductPendingDeactivate] =
    useState<CatalogProduct | null>(null)
  const loadGenerationRef = useRef(0)
  const loadAbortControllerRef = useRef<AbortController | null>(null)

  const reload = useCallback(async () => {
    loadAbortControllerRef.current?.abort()
    const controller = new AbortController()
    loadAbortControllerRef.current = controller
    const generation = ++loadGenerationRef.current
    setLoading(true)
    try {
      const [nextProducts, nextRequests] = await Promise.all([
        listCatalogProducts(
          { category: taxonomyFilter.categoryId, tags: taxonomyFilter.tagIds },
          { signal: controller.signal },
        ),
        listProductRequests({ signal: controller.signal }),
      ])
      if (controller.signal.aborted || generation !== loadGenerationRef.current) {
        return
      }
      setProducts(nextProducts)
      setRequests(nextRequests)
      setLoadError(null)
      const menu = canReadMenu
        ? await listTenantModuleMenuItems().catch(() => null)
        : null
      const links = rentals
        ? await Promise.all(nextProducts.map(async (product) => {
          try {
            const data = await getCatalogProductResourceRequirements(product.id)
            return [product.id, data.requirements.some((row) => (row.rentalAssetId?.trim().length ?? 0) > 0)] as const
          } catch {
            return [product.id, false] as const
          }
        }))
        : []
      if (controller.signal.aborted || generation !== loadGenerationRef.current) {
        return
      }
      setCatalogMenu(menu === null ? null : catalogMenuIsActive(menu))
      setLinked(Object.fromEntries(links))
    } catch (error) {
      if (controller.signal.aborted || generation !== loadGenerationRef.current) {
        return
      }
      setLoadError(
        error instanceof Error ? error.message : t("apiErrors.loadCatalogProducts"),
      )
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [canReadMenu, rentals, t, taxonomyFilter.categoryId, taxonomyFilter.tagIds])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- request lifecycle owns loading state
    void reload()
    return () => loadAbortControllerRef.current?.abort()
  }, [reload])

  const updateTaxonomyFilter = useCallback((next: { categoryId: string | null; tagIds: string[] }) => {
    setSearchParams((current) => setTaxonomySearchParams(current, {
      category: next.categoryId,
      tags: next.tagIds,
    }))
  }, [setSearchParams])

  useEffect(() => {
    void getCatalogTaxonomyOptions()
      .then(setTaxonomyOptions)
      .catch(() => setTaxonomyOptions({ categories: [], tags: [] }))
  }, [])

  function openEdit(product: CatalogProduct) {
    void navigate(`/catalogo/produtos/${product.id}`)
  }

  function requestToggleActive(product: CatalogProduct) {
    if (product.isActive) {
      setProductPendingDeactivate(product)
      return
    }

    void toggleActive(product)
  }

  async function toggleActive(product: CatalogProduct) {
    setStatusBusyId(product.id)
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
        error instanceof Error
          ? error.message
          : t("apiErrors.updateCatalogProductStatus"),
      )
    } finally {
      setStatusBusyId(null)
    }
  }

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(i18n.language)
    return products.filter((product) => {
      if (statusFilter !== "all" && product.isActive !== (statusFilter === "active")) return false
      if (visibilityFilter !== "all" && (product.visibility ?? "Public") !== visibilityFilter) return false
      return needle === "" || `${product.name} ${product.code ?? ""}`.toLocaleLowerCase(i18n.language).includes(needle)
    })
  }, [i18n.language, products, search, statusFilter, visibilityFilter])

  const taxonomyFilterActive = !!taxonomyFilter.categoryId || taxonomyFilter.tagIds.length > 0
  const filtered = products.length > 0 || search.trim() !== "" || statusFilter !== "all" || visibilityFilter !== "all" || taxonomyFilterActive

  function productPrice(product: CatalogProduct) {
    return formatCatalogMoney(product.price, product.currency, i18n.language) ?? t("catalog.priceOnRequest")
  }

  const columns: DataListColumn<CatalogProduct>[] = [
    {
      id: "name",
      header: t("catalog.products.columns.name"),
      cell: (product) => <ProductNameBlock product={product} onEdit={openEdit} />,
    },
    {
      id: "code",
      header: t("catalog.products.columns.code"),
      hideBelow: "lg",
      className: "font-mono text-xs text-muted-foreground whitespace-nowrap",
      cell: (product) => product.code ?? "—",
    },
    {
      id: "visibility",
      header: t("catalog.products.access.title"),
      cell: (product) => <ProductAccess product={product} />,
    },
    {
      id: "price",
      header: t("catalog.products.columns.price"),
      align: "end",
      className: "whitespace-nowrap tabular-nums",
      cell: (product) => productPrice(product),
    },
    {
      id: "status",
      header: t("catalog.products.columns.status"),
      cell: (product) => <ProductStatus product={product} onToggle={requestToggleActive} busyId={statusBusyId} />,
    },
    {
      id: "categories",
      header: t("taxonomy.categories"),
      hideBelow: "lg",
      cell: (product) => <TaxonomyChips items={product.taxonomy?.categories} />,
    },
    {
      id: "tags",
      header: t("taxonomy.tags"),
      hideBelow: "lg",
      cell: (product) => <TaxonomyChips items={product.taxonomy?.tags} />,
    },
    {
      id: "actions",
      header: t("catalog.products.columns.actions"),
      align: "end",
      className: "md:max-lg:sticky md:max-lg:right-0 md:max-lg:z-[1] md:max-lg:bg-card",
      cell: (product) => <ProductActions product={product} onEdit={openEdit} onToggle={requestToggleActive} busyId={statusBusyId} />,
    },
  ]

  const emptyProducts: EmptyStateProps = {
    icon: Package,
    title: t(filtered ? "catalog.staff.noResults" : "catalog.products.empty"),
    description: t(filtered ? "catalog.staff.adjustFilters" : "catalog.staff.empty.products"),
    action: filtered ? undefined : (
      <Can permission="catalog.products.manage">
        <Link className={buttonVariants()} to="/catalogo/produtos/cadastro">
          <Plus data-icon="inline-start" />
          {t("catalog.products.create")}
        </Link>
      </Can>
    ),
  }

  const filterChips: { label: string; onRemove: () => void }[] = []
  if (statusFilter !== "all") {
    filterChips.push({
      label: `${t("catalog.products.columns.status")}: ${t(statusFilter === "active" ? "catalog.products.active" : "catalog.products.inactive")}`,
      onRemove: () => setStatusFilter("all"),
    })
  }
  if (visibilityFilter !== "all") {
    filterChips.push({
      label: `${t("catalog.products.visibilityFilter.title")}: ${t(`catalog.products.visibilityFilter.${visibilityFilter === "Public" ? "public" : "restricted"}`)}`,
      onRemove: () => setVisibilityFilter("all"),
    })
  }
  const activeCategory = taxonomyOptions.categories.find((item) => item.id === taxonomyFilter.categoryId)
  if (activeCategory) {
    filterChips.push({
      label: `${t("taxonomy.categories")}: ${activeCategory.name}`,
      onRemove: () => updateTaxonomyFilter({ ...taxonomyFilter, categoryId: null }),
    })
  }
  for (const tag of taxonomyOptions.tags.filter((item) => taxonomyFilter.tagIds.includes(item.id))) {
    filterChips.push({
      label: `${t("taxonomy.tags")}: ${tag.name}`,
      onRemove: () => updateTaxonomyFilter({ ...taxonomyFilter, tagIds: taxonomyFilter.tagIds.filter((id) => id !== tag.id) }),
    })
  }

  const filterBar = (
    <FilterBar
      label={t("catalog.staff.productsSearch")}
      search={{ value: search, onChange: setSearch, label: t("catalog.staff.productsSearch"), placeholder: t("catalog.staff.productsSearchShort") }}
      filters={
        <>
          <SegmentedControl<StatusFilter>
            label={t("catalog.products.columns.status")}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: t("catalog.products.filterAll") },
              { value: "active", label: t("catalog.products.active") },
              { value: "inactive", label: t("catalog.products.inactive") },
            ]}
          />
          <SegmentedControl<VisibilityFilter>
            label={t("catalog.products.visibilityFilter.title")}
            value={visibilityFilter}
            onChange={setVisibilityFilter}
            options={[
              { value: "all", label: t("catalog.products.filterAll") },
              { value: "Public", label: t("catalog.products.visibilityFilter.public") },
              { value: "Restricted", label: t("catalog.products.visibilityFilter.restricted") },
            ]}
          />
          <TaxonomyFilterHeader kind="categories" title={t("taxonomy.categories")} options={taxonomyOptions} filter={taxonomyFilter} onChange={updateTaxonomyFilter} />
          <TaxonomyFilterHeader kind="tags" title={t("taxonomy.tags")} options={taxonomyOptions} filter={taxonomyFilter} onChange={updateTaxonomyFilter} />
        </>
      }
      chips={filterChips}
    />
  )

  const requestColumns = [
    { id: "description", header: t("catalog.requests.columns.description") },
    { id: "quantity", header: t("catalog.requests.columns.quantity") },
    { id: "note", header: t("catalog.requests.columns.note") },
    { id: "createdAt", header: t("catalog.requests.columns.createdAt") },
  ] as const

  function requestCell(request: ProductRequest, id: (typeof requestColumns)[number]["id"]) {
    switch (id) {
      case "description":
        return request.description
      case "quantity":
        return request.quantity
      case "note":
        return request.note ?? <><span className="staff-catalog-desktop-note">—</span><span className="staff-catalog-mobile-note">{t("catalog.staff.noNote")}</span></>
      case "createdAt":
        return new Intl.DateTimeFormat(i18n.language, {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        }).format(new Date(request.createdAt))
    }
  }

  if (view === "requests") {
    return (
      <div className="staff-catalog">
        <CatalogHeading title={t("catalog.requests.title")} description={t("catalog.requests.subtitle")} />
        <CatalogTabs active="requests" counts={loading || loadError ? {} : { products: products.length, requests: requests.length }} />
        {loadError ? <Alert variant="destructive" className="staff-catalog-error"><AlertDescription>{loadError}</AlertDescription></Alert> : null}
        <div className="staff-catalog-card" aria-busy={loading}>
          {loading ? <span role="status" className="sr-only">{t("catalog.staff.loading")}</span> : null}
          {!loading && !loadError && requests.length === 0 ? <CatalogEmptyState kind="requests" /> : (
            <Table role="table" className="staff-catalog-table staff-catalog-requests-table" aria-label={t("catalog.requests.title")}>
              <TableHeader role="rowgroup">
                <TableRow role="row">{requestColumns.map((column) => (
                  <TableHead role="columnheader" key={column.id} data-column={column.id}>{column.header}</TableHead>
                ))}</TableRow>
              </TableHeader>
              <TableBody role="rowgroup">
                {loading ? <TableRowsSkeleton columns={4} rows={3} /> : loadError ? null : requests.map((request) => (
                  <TableRow role="row" key={request.id}>{requestColumns.map((column) => (
                    <TableCell role="cell" key={column.id} data-column={column.id}>
                      {column.id === "quantity" ? <span className="staff-catalog-mobile-label">{t("catalog.requests.columns.quantity")} </span> : null}
                      {requestCell(request, column.id)}
                    </TableCell>
                  ))}</TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    )
  }

  return (
    <ProductSetupContext.Provider value={{ menuPublished: catalogMenu, linked, rentals }}>
    <div className="staff-catalog">
      <CatalogHeading
        title={t("catalog.products.title")}
        description={t("catalog.products.subtitle")}
        actions={
          <Can permission="catalog.products.manage">
            <Link className={buttonVariants()} to="/catalogo/produtos/cadastro">
              <Plus data-icon="inline-start" />
              {t("catalog.products.create")}
            </Link>
          </Can>
        }
      />
      <CatalogTabs active="products" counts={loading || loadError ? {} : { products: products.length, requests: requests.length }} />
      <DataList<CatalogProduct>
        {...(loadError !== null
          ? { state: "error" as const, error: loadError, onRetry: () => { void reload() } }
          : { state: loading ? ("loading" as const) : ("ready" as const) })}
        label={t("catalog.products.title")}
        loadingLabel={t("catalog.staff.loading")}
        toolbar={filterBar}
        columns={columns}
        rows={visibleProducts}
        getRowId={(product) => product.id}
        empty={emptyProducts}
        renderCard={(product) => (
          <>
            <ProductNameBlock product={product} onEdit={openEdit} />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="font-medium tabular-nums [overflow-wrap:anywhere]">{productPrice(product)}</span>
              <ProductStatus product={product} onToggle={requestToggleActive} busyId={statusBusyId} />
            </div>
            <dl className="grid min-w-0 gap-1 text-sm text-muted-foreground">
              <div className="flex min-w-0 flex-wrap gap-x-2">
                <dt>{t("catalog.products.columns.code")}</dt>
                <dd className="font-mono [overflow-wrap:anywhere]">{product.code ?? "—"}</dd>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2">
                <dt>{t("catalog.products.access.title")}</dt>
                <dd><ProductAccess product={product} /></dd>
              </div>
            </dl>
            <TaxonomyChips items={[...(product.taxonomy?.categories ?? []), ...(product.taxonomy?.tags ?? [])]} hideEmpty />
            <ProductActions product={product} onEdit={openEdit} onToggle={requestToggleActive} busyId={statusBusyId} card />
          </>
        )}
      />

      <Dialog
        open={productPendingDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProductPendingDeactivate(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("catalog.products.deactivateConfirmTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.products.deactivateConfirmBody", {
                name: productPendingDeactivate?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProductPendingDeactivate(null)
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const product = productPendingDeactivate
                setProductPendingDeactivate(null)
                if (product) {
                  void toggleActive(product)
                }
              }}
            >
              {t("catalog.products.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ProductSetupContext.Provider>
  )
}

type StatusFilter = "all" | "active" | "inactive"
type VisibilityFilter = "all" | "Public" | "Restricted"

type ProductHandlers = {
  onEdit: (product: CatalogProduct) => void
  onToggle: (product: CatalogProduct) => void
  busyId: string | null
}

function ProductNameBlock({ product, onEdit }: { product: CatalogProduct; onEdit: (product: CatalogProduct) => void }) {
  const { can } = usePermissions()
  const setup = useContext(ProductSetupContext)
  const setupStatus = productItemStatus({
    name: product.name,
    isActive: product.isActive,
    price: product.price,
    audienceReady: product.visibility !== "Restricted",
    agendaReady: !setup.rentals || setup.linked[product.id] === true,
    menuPublished: setup.menuPublished,
  })
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="staff-catalog-product-icon"><Package size={20} aria-hidden="true" /></span>
      <span className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
        {can("catalog.products.manage") ? (
          <button type="button" className="touch-target block max-w-full rounded-md text-left" onClick={() => onEdit(product)}>
            <strong className="block font-semibold">{product.name}</strong>
          </button>
        ) : <strong className="block font-semibold">{product.name}</strong>}
        <ItemStatusBadge status={setupStatus} />
        {product.description ? <small className="block text-xs text-muted-foreground">{product.description}</small> : null}
      </span>
    </div>
  )
}

function ProductAccess({ product }: { product: CatalogProduct }) {
  const { t } = useTranslation()
  if ((product.visibility ?? "Public") !== "Restricted") {
    return <span className="text-muted-foreground">{t("catalog.products.visibilityFilter.public")}</span>
  }
  return (
    <Badge variant="outline">
      {t("catalog.products.badges.restricted", {
        count: (product.grantedCustomerCount ?? 0) + (product.grantedGroupCount ?? 0),
      })}
    </Badge>
  )
}

function ProductStatus({ product, onToggle, busyId }: { product: CatalogProduct; onToggle: ProductHandlers["onToggle"]; busyId: string | null }) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const status = <span className="staff-catalog-status" data-tone={product.isActive ? "success" : "muted"}>
    {t(product.isActive ? "catalog.products.active" : "catalog.products.inactive")}
  </span>
  return can("catalog.products.manage") ? (
    <button type="button" className="touch-target rounded-lg disabled:opacity-50"
      aria-label={`${t(product.isActive ? "catalog.products.deactivate" : "catalog.products.activate")}: ${product.name}`}
      disabled={busyId === product.id} aria-busy={busyId === product.id}
      onClick={() => onToggle(product)}>{status}</button>
  ) : status
}

function TaxonomyChips({ items, hideEmpty = false }: { items?: readonly { id: string; name: string }[]; hideEmpty?: boolean }) {
  if (!items?.length) return hideEmpty ? null : <>—</>
  return <div className="staff-catalog-tags">{items.map((item) => <span key={item.id}>{item.name}</span>)}</div>
}

function ProductActions({ product, onEdit, onToggle, busyId, card = false }: ProductHandlers & { product: CatalogProduct; card?: boolean }) {
  const { t } = useTranslation()
  const quickEditLabel = t("catalog.products.quickEdit")
  const editLabel = t("common.edit")
  const activeLabel = product.isActive
    ? t("catalog.products.deactivate")
    : t("catalog.products.activate")
  const wizardLabel = t("catalog.productWizard.open")

  return (
    <div className={cn("staff-catalog-actions", card && "flex-wrap justify-stretch")}>
      <Link
        className={cn("staff-catalog-assistant", card && "w-full")}
        to={productWizardPath(product.id)}
        aria-label={`${wizardLabel}: ${product.name}`}
        title={wizardLabel}
      >
        {wizardLabel}
      </Link>
      <Can permission="catalog.products.manage">
        <Link
          className={cn(buttonVariants({ variant: "outline", size: card ? "default" : "icon" }), card ? "min-h-11 min-w-0 flex-1" : "staff-catalog-action")}
          aria-label={`${quickEditLabel}: ${product.name}`}
          title={quickEditLabel}
          to={productWizardPath(product.id, "offer")}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
        </Link>
        <Button
          type="button"
          variant="outline"
          size={card ? "default" : "icon"}
          className={card ? "min-h-11 min-w-0 flex-1" : "staff-catalog-action"}
          aria-label={`${editLabel}: ${product.name}`}
          title={editLabel}
          onClick={() => onEdit(product)}
        >
          <Pencil size={16} aria-hidden="true" />
        </Button>
        <LoadingButton
          type="button"
          variant="outline"
          size={card ? "default" : "icon"}
          className={card ? "min-h-11 min-w-0 flex-1" : "staff-catalog-action"}
          aria-label={`${activeLabel}: ${product.name}`}
          title={activeLabel}
          loading={busyId === product.id}
          onClick={() => onToggle(product)}
        >
          <Power size={16} aria-hidden="true" />
        </LoadingButton>
      </Can>
    </div>
  )
}

function TaxonomyFilterHeader({ kind, title, options, filter, onChange }: {
  kind: "categories" | "tags"
  title: string
  options: TaxonomyOptions
  filter: { categoryId: string | null; tagIds: string[] }
  onChange: (value: { categoryId: string | null; tagIds: string[] }) => void
}) {
  const { t } = useTranslation()
  const active = kind === "categories" ? !!filter.categoryId : filter.tagIds.length > 0
  const categories = [...options.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" className="staff-catalog-filter" data-active={active} />}>
        {title}
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        {kind === "categories" ? <label className="grid gap-2 text-sm font-medium">
          {t("tenantPortal.catalog.categoryLabel")}
          <select className="min-h-11 w-full rounded-lg border border-input bg-background px-3" value={filter.categoryId ?? ""}
            onChange={(event) => onChange({ ...filter, categoryId: event.target.value || null })}>
            <option value="">{t("tenantPortal.catalog.allCategories")}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label> : <fieldset>
          <legend className="text-sm font-medium">{t("taxonomy.tags")}</legend>
          <p className="mb-2 text-xs text-muted-foreground">{t("tenantPortal.catalog.tagsHint")}</p>
          {options.tags.map((tag) => <label key={tag.id} className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox checked={filter.tagIds.includes(tag.id)} onChange={() => onChange({ ...filter,
              tagIds: filter.tagIds.includes(tag.id) ? filter.tagIds.filter((id) => id !== tag.id) : [...filter.tagIds, tag.id],
            })} />{tag.name}
          </label>)}
        </fieldset>}
        {active ? <Button type="button" variant="ghost" className="min-h-11" onClick={() => onChange({ categoryId: null, tagIds: [] })}>
          {t("tenantPortal.catalog.clearFilters")}
        </Button> : null}
      </PopoverContent>
    </Popover>
  )
}
