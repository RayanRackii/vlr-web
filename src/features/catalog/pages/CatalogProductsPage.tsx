import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { MoreHorizontal, Package, Plus, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { StatusChips } from "@/components/data-table/StatusChips"
import { StatusBadge } from "@/components/ui/status"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { productItemStatus } from "@/features/assistant/itemStatus"
import { CatalogEmptyState, CatalogHeading } from "@/features/catalog/components/StaffCatalogChrome"
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null)
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

  const states = useMemo(() => {
    const setup = { menuPublished: catalogMenu, linked, rentals }
    return new Map(products.map((product) => [product.id, productState(product, setup)] as const))
  }, [catalogMenu, linked, products, rentals])
  const stateOf = useCallback(
    (product: CatalogProduct): ProductState => states.get(product.id) ?? { kind: product.isActive ? "active" : "inactive", missing: 0 },
    [states],
  )
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { active: 0, inactive: 0, incomplete: 0 }
    for (const state of states.values()) counts[state.kind] += 1
    return counts
  }, [states])

  const visibleProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(i18n.language)
    return products.filter((product) => {
      if (statusFilter !== null && stateOf(product).kind !== statusFilter) return false
      if (visibilityFilter !== "all" && (product.visibility ?? "Public") !== visibilityFilter) return false
      return needle === "" || `${product.name} ${product.code ?? ""}`.toLocaleLowerCase(i18n.language).includes(needle)
    })
  }, [i18n.language, products, search, statusFilter, stateOf, visibilityFilter])

  const taxonomyFilterActive = !!taxonomyFilter.categoryId || taxonomyFilter.tagIds.length > 0
  const filtered = products.length > 0 || search.trim() !== "" || statusFilter !== null || visibilityFilter !== "all" || taxonomyFilterActive
  const showCategories = visibleProducts.some((product) => (product.taxonomy?.categories?.length ?? 0) > 0)
  const showTags = visibleProducts.some((product) => (product.taxonomy?.tags?.length ?? 0) > 0)

  function productPrice(product: CatalogProduct) {
    return formatCatalogMoney(product.price, product.currency, i18n.language) ?? t("catalog.priceOnRequest")
  }

  const menuFor = (product: CatalogProduct) => (
    <ProductMenu product={product} state={stateOf(product)} onToggle={requestToggleActive} busyId={statusBusyId} />
  )

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
      id: "price",
      header: t("catalog.products.columns.price"),
      align: "end",
      className: "whitespace-nowrap tabular-nums",
      cell: (product) => productPrice(product),
    },
    {
      id: "status",
      header: t("catalog.products.columns.status"),
      cell: (product) => <ProductStatus state={stateOf(product)} />,
    },
    ...(showCategories ? [{
      id: "categories",
      header: t("taxonomy.categories"),
      hideBelow: "lg" as const,
      cell: (product: CatalogProduct) => <TaxonomyChips items={product.taxonomy?.categories} />,
    }] : []),
    ...(showTags ? [{
      id: "tags",
      header: t("taxonomy.tags"),
      hideBelow: "lg" as const,
      cell: (product: CatalogProduct) => <TaxonomyChips items={product.taxonomy?.tags} />,
    }] : []),
    {
      id: "actions",
      header: <span className="sr-only">{t("catalog.products.columns.actions")}</span>,
      align: "end",
      cell: menuFor,
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
          <StatusChips<StatusFilter>
            label={t("catalog.products.statusFilter")}
            allLabel={t("catalog.products.filterAll")}
            allCount={products.length}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "active", label: t("catalog.products.filterActive"), tone: "success", count: statusCounts.active },
              { value: "inactive", label: t("catalog.products.filterInactive"), tone: "neutral", count: statusCounts.inactive },
              { value: "incomplete", label: t("catalog.products.filterIncomplete"), tone: "warning", count: statusCounts.incomplete },
            ]}
          />
          <MoreFilters
            options={taxonomyOptions}
            taxonomy={taxonomyFilter}
            onTaxonomyChange={updateTaxonomyFilter}
            visibility={visibilityFilter}
            onVisibilityChange={setVisibilityFilter}
          />
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
            <div className="flex min-w-0 items-start justify-between gap-2">
              <ProductNameBlock product={product} onEdit={openEdit} />
              {menuFor(product)}
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span className="font-medium tabular-nums [overflow-wrap:anywhere]">{productPrice(product)}</span>
              <ProductStatus state={stateOf(product)} />
            </div>
            {product.code ? <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">{product.code}</p> : null}
            <TaxonomyChips items={[...(product.taxonomy?.categories ?? []), ...(product.taxonomy?.tags ?? [])]} hideEmpty />
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
  )
}

type StatusFilter = "active" | "inactive" | "incomplete"
type VisibilityFilter = "all" | "Public" | "Restricted"
type ProductState = { kind: StatusFilter; missing: number }

/** One status per product: incomplete (steps missing) wins, else the active flag. */
function productState(
  product: CatalogProduct,
  setup: { menuPublished: boolean | null; linked: Readonly<Record<string, boolean>>; rentals: boolean },
): ProductState {
  const status = productItemStatus({
    name: product.name,
    isActive: product.isActive,
    price: product.price,
    audienceReady: product.visibility !== "Restricted",
    agendaReady: !setup.rentals || setup.linked[product.id] === true,
    menuPublished: setup.menuPublished,
  })
  if (status.kind === "missing") return { kind: "incomplete", missing: status.count }
  return { kind: product.isActive ? "active" : "inactive", missing: 0 }
}

function ProductNameBlock({ product, onEdit }: { product: CatalogProduct; onEdit: (product: CatalogProduct) => void }) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const restricted = (product.visibility ?? "Public") === "Restricted"
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="staff-catalog-product-icon"><Package size={20} aria-hidden="true" /></span>
      <span className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {can("catalog.products.manage") ? (
            <button type="button" className="touch-target block max-w-full rounded-md text-left" onClick={() => onEdit(product)}>
              <strong className="block font-semibold">{product.name}</strong>
            </button>
          ) : <strong className="block font-semibold">{product.name}</strong>}
          {restricted ? (
            <Badge variant="outline">
              {t("catalog.products.badges.restricted", {
                count: (product.grantedCustomerCount ?? 0) + (product.grantedGroupCount ?? 0),
              })}
            </Badge>
          ) : null}
        </span>
        {product.description ? <small className="block text-xs text-muted-foreground">{product.description}</small> : null}
      </span>
    </div>
  )
}

function ProductStatus({ state }: { state: ProductState }) {
  const { t } = useTranslation()
  if (state.kind === "incomplete") {
    return <StatusBadge tone="warning">{t("catalog.products.statusIncomplete", { count: state.missing })}</StatusBadge>
  }
  return state.kind === "active"
    ? <StatusBadge tone="success">{t("catalog.products.active")}</StatusBadge>
    : <StatusBadge tone="neutral">{t("catalog.products.inactive")}</StatusBadge>
}

function TaxonomyChips({ items, hideEmpty = false }: { items?: readonly { id: string; name: string }[]; hideEmpty?: boolean }) {
  if (!items?.length) return hideEmpty ? null : <>—</>
  return <div className="staff-catalog-tags">{items.map((item) => <span key={item.id}>{item.name}</span>)}</div>
}

/** One 44px row menu: Acesso, Ativar/Desativar and, only when incomplete, Continuar configuração. */
function ProductMenu({ product, state, onToggle, busyId }: {
  product: CatalogProduct
  state: ProductState
  onToggle: (product: CatalogProduct) => void
  busyId: string | null
}) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const canManage = can("catalog.products.manage")
  const incomplete = state.kind === "incomplete"
  if (!canManage && !incomplete) return null
  const busy = busyId === product.id
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("catalog.products.rowMenu", { name: product.name })} aria-busy={busy} />}
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManage ? (
          <DropdownMenuItem className="min-h-11 py-2.5" render={<Link to={productWizardPath(product.id, "access")} />}>
            {t("catalog.products.menuAccess")}
          </DropdownMenuItem>
        ) : null}
        {canManage ? (
          <DropdownMenuItem className="min-h-11 py-2.5" disabled={busy} onClick={() => onToggle(product)}>
            {t(product.isActive ? "catalog.products.deactivate" : "catalog.products.activate")}
          </DropdownMenuItem>
        ) : null}
        {incomplete ? (
          <DropdownMenuItem className="min-h-11 py-2.5" render={<Link to={productWizardPath(product.id)} />}>
            {t("catalog.products.menuContinue")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MoreFilters({ options, taxonomy, onTaxonomyChange, visibility, onVisibilityChange }: {
  options: TaxonomyOptions
  taxonomy: { categoryId: string | null; tagIds: string[] }
  onTaxonomyChange: (value: { categoryId: string | null; tagIds: string[] }) => void
  visibility: VisibilityFilter
  onVisibilityChange: (value: VisibilityFilter) => void
}) {
  const { t } = useTranslation()
  const activeCount = (visibility !== "all" ? 1 : 0) + (taxonomy.categoryId ? 1 : 0) + taxonomy.tagIds.length
  const categories = [...options.categories].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" className="min-h-11 min-w-11 gap-2 rounded-lg px-3 text-sm data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary" data-active={activeCount > 0} />}>
        <SlidersHorizontal aria-hidden="true" />
        {t("catalog.products.moreFilters")}
        {activeCount > 0 ? <span className="text-xs font-semibold tabular-nums" data-testid="more-filters-count">{activeCount}</span> : null}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)] space-y-4" align="start">
        <SegmentedControl<VisibilityFilter>
          label={t("catalog.products.visibilityFilter.title")}
          value={visibility}
          onChange={onVisibilityChange}
          options={[
            { value: "all", label: t("catalog.products.filterAll") },
            { value: "Public", label: t("catalog.products.visibilityFilter.public") },
            { value: "Restricted", label: t("catalog.products.visibilityFilter.restricted") },
          ]}
        />
        <label className="grid gap-2 text-sm font-medium">
          {t("tenantPortal.catalog.categoryLabel")}
          <select className="min-h-11 w-full rounded-lg border border-input bg-background px-3" value={taxonomy.categoryId ?? ""}
            onChange={(event) => onTaxonomyChange({ ...taxonomy, categoryId: event.target.value || null })}>
            <option value="">{t("tenantPortal.catalog.allCategories")}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        {options.tags.length > 0 ? (
          <fieldset>
            <legend className="text-sm font-medium">{t("taxonomy.tags")}</legend>
            <p className="mb-2 text-xs text-muted-foreground">{t("tenantPortal.catalog.tagsHint")}</p>
            {options.tags.map((tag) => <label key={tag.id} className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox checked={taxonomy.tagIds.includes(tag.id)} onChange={() => onTaxonomyChange({ ...taxonomy,
                tagIds: taxonomy.tagIds.includes(tag.id) ? taxonomy.tagIds.filter((id) => id !== tag.id) : [...taxonomy.tagIds, tag.id],
              })} />{tag.name}
            </label>)}
          </fieldset>
        ) : null}
        {activeCount > 0 ? <Button type="button" variant="ghost" className="min-h-11" onClick={() => {
          onVisibilityChange("all")
          onTaxonomyChange({ categoryId: null, tagIds: [] })
        }}>
          {t("tenantPortal.catalog.clearFilters")}
        </Button> : null}
      </PopoverContent>
    </Popover>
  )
}
