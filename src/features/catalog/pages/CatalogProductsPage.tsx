import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
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
import { CatalogColumnFilter, CatalogEmptyState, CatalogHeading, CatalogSearch, CatalogTabs } from "@/features/catalog/components/StaffCatalogChrome"
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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
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

  const columns = useMemo<ColumnDef<CatalogProduct>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("catalog.products.columns.name"),
        cell: CatalogProductNameCell,
      },
      {
        accessorKey: "code",
        header: t("catalog.products.columns.code"),
        cell: ({ row }) => row.original.code ?? "—",
      },
      {
        id: "visibility",
        accessorFn: (row) => row.visibility ?? "Public",
        header: t("catalog.products.access.title"),
        cell: ({ row }) => {
          const product = row.original
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
        },
        filterFn: (row, _columnId, filterValue) =>
          typeof filterValue !== "string" || filterValue.trim() === ""
            ? true
            : (row.original.visibility ?? "Public") === filterValue,
      },
      {
        id: "price",
        accessorFn: (row) =>
          formatCatalogMoney(row.price, row.currency, i18n.language) ??
          t("catalog.priceOnRequest"),
        header: t("catalog.products.columns.price"),
        cell: ({ row, getValue }) => <div className="staff-catalog-mobile-price">
          <span>{String(getValue())}</span>
          <div className="staff-catalog-mobile-product-tags staff-catalog-tags">
            {row.original.taxonomy?.categories.map((item) => <span key={`category-${item.id}`}>{item.name}</span>)}
            {row.original.taxonomy?.tags.map((item) => <span key={`tag-${item.id}`}>{item.name}</span>)}
          </div>
        </div>,
      },
      {
        accessorKey: "isActive",
        header: t("catalog.products.columns.status"),
        cell: CatalogProductStatusCell,
        filterFn: (row, _columnId, filterValue) => {
          if (typeof filterValue !== "string" || filterValue.trim() === "") {
            return true
          }
          if (filterValue === "true" || filterValue === "false") {
            return row.original.isActive === (filterValue === "true")
          }
          const label = row.original.isActive
            ? t("catalog.products.active")
            : t("catalog.products.inactive")
          return label.toLowerCase().includes(filterValue.trim().toLowerCase())
        },
      },
      {
        id: "categories",
        accessorFn: (row) => row.taxonomy?.categories.map((item) => item.name).join(", ") ?? "",
        header: t("taxonomy.categories"),
        cell: ({ row }) => <div className="staff-catalog-tags">{row.original.taxonomy?.categories.length ? row.original.taxonomy.categories.map((item) => <span key={item.id}>{item.name}</span>) : "—"}</div>,
      },
      {
        id: "tags",
        accessorFn: (row) => row.taxonomy?.tags.map((item) => item.name).join(", ") ?? "",
        header: t("taxonomy.tags"),
        cell: ({ row }) => <div className="staff-catalog-tags">{row.original.taxonomy?.tags.length ? row.original.taxonomy.tags.map((item) => <span key={item.id}>{item.name}</span>) : "—"}</div>,
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: t("catalog.products.columns.actions"),
        cell: CatalogProductActionsCell,
      },
    ],
    [i18n.language, t],
  )

  const table = useReactTable({
    data: products,
    columns,
    state: { columnFilters, globalFilter: search },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _columnId, value: string) =>
      `${row.original.name} ${row.original.code ?? ""}`.toLocaleLowerCase(i18n.language).includes(value.toLocaleLowerCase(i18n.language)),
    meta: {
      onEdit: openEdit,
      onToggleActive: requestToggleActive,
      statusBusyId,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const requestColumns = useMemo<ColumnDef<ProductRequest>[]>(
    () => [
      {
        accessorKey: "description",
        header: t("catalog.requests.columns.description"),
      },
      {
        accessorKey: "quantity",
        header: t("catalog.requests.columns.quantity"),
        enableColumnFilter: false,
      },
      {
        accessorKey: "note",
        header: t("catalog.requests.columns.note"),
        cell: ({ row }) => row.original.note ?? <><span className="staff-catalog-desktop-note">—</span><span className="staff-catalog-mobile-note">{t("catalog.staff.noNote")}</span></>,
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.requests.columns.createdAt"),
        enableColumnFilter: false,
        cell: ({ row }) =>
          new Intl.DateTimeFormat(i18n.language, {
            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
          }).format(new Date(row.original.createdAt)),
      },
    ],
    [i18n.language, t],
  )

  const [requestFilters, setRequestFilters] = useState<ColumnFiltersState>([])
  const requestTable = useReactTable({
    data: requests,
    columns: requestColumns,
    state: { columnFilters: requestFilters },
    onColumnFiltersChange: setRequestFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

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
              <TableHeader role="rowgroup">{requestTable.getHeaderGroups().map((group) => (
                <TableRow role="row" key={group.id}>{group.headers.map((header) => (
                  <TableHead role="columnheader" key={header.id} data-column={header.column.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}</TableRow>
              ))}</TableHeader>
              <TableBody role="rowgroup">
                {loading ? <TableRowsSkeleton columns={4} rows={3} /> : loadError ? null : requestTable.getRowModel().rows.map((row) => (
                  <TableRow role="row" key={row.id}>{row.getVisibleCells().map((cell) => (
                    <TableCell role="cell" key={cell.id} data-column={cell.column.id}>
                      {cell.column.id === "quantity" ? <span className="staff-catalog-mobile-label">{t("catalog.requests.columns.quantity")} </span> : null}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
            <Link className={buttonVariants()} to="/catalogo/produtos/novo">
              <Plus data-icon="inline-start" />
              {t("catalog.products.create")}
            </Link>
          </Can>
        }
      />
      <CatalogTabs active="products" counts={loading || loadError ? {} : { products: products.length, requests: requests.length }} />
      {loadError ? <Alert variant="destructive" className="staff-catalog-error"><AlertDescription>{loadError}</AlertDescription></Alert> : null}
      <div className="staff-catalog-card" aria-busy={loading}>
        <div className="staff-catalog-toolbar">
          <CatalogSearch value={search} onChange={setSearch} label={t("catalog.staff.productsSearch")} placeholder={t("catalog.staff.productsSearchShort")} />
          <CatalogColumnFilter column={table.getColumn("isActive")!} title={t("catalog.products.columns.status")}
            options={[{ value: "true", label: t("catalog.products.active") }, { value: "false", label: t("catalog.products.inactive") }]} />
          <CatalogColumnFilter column={table.getColumn("visibility")!} title={t("catalog.products.visibilityFilter.title")}
            options={[{ value: "Public", label: t("catalog.products.visibilityFilter.public") }, { value: "Restricted", label: t("catalog.products.visibilityFilter.restricted") }]} />
          <TaxonomyFilterHeader kind="categories" title={t("taxonomy.categories")} options={taxonomyOptions} filter={taxonomyFilter} onChange={updateTaxonomyFilter} />
          <TaxonomyFilterHeader kind="tags" title={t("taxonomy.tags")} options={taxonomyOptions} filter={taxonomyFilter} onChange={updateTaxonomyFilter} />
        </div>
        {loading ? <span role="status" className="sr-only">{t("catalog.staff.loading")}</span> : null}
        {!loading && !loadError && table.getRowModel().rows.length === 0 ? <CatalogEmptyState kind="products" action={<Can permission="catalog.products.manage"><Link className={buttonVariants()} to="/catalogo/produtos/novo"><Plus data-icon="inline-start" />{t("catalog.products.create")}</Link></Can>} filtered={products.length > 0 || !!search || columnFilters.length > 0 || !!taxonomyFilter.categoryId || taxonomyFilter.tagIds.length > 0} /> : (
          <Table role="table" className="staff-catalog-table staff-catalog-products-table" aria-label={t("catalog.products.title")}>
            <TableHeader role="rowgroup">{table.getHeaderGroups().map((group) => (
              <TableRow role="row" key={group.id}>{group.headers.map((header) => (
                <TableHead role="columnheader" key={header.id} data-column={header.column.id} className={header.column.id === "actions" ? "md:max-lg:right-0" : undefined}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}</TableRow>
            ))}</TableHeader>
            <TableBody role="rowgroup">
              {loading ? <TableRowsSkeleton columns={7} rows={4} /> : loadError ? null : table.getRowModel().rows.map((row) => (
                <TableRow role="row" key={row.id}>{row.getVisibleCells().map((cell) => (
                  <TableCell role="cell" key={cell.id} data-column={cell.column.id} className={cell.column.id === "actions" ? "md:max-lg:sticky md:max-lg:right-0 md:max-lg:z-[1] md:max-lg:bg-card" : undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}</TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>


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

type CatalogProductsTableMeta = {
  onEdit: (product: CatalogProduct) => void
  onToggleActive: (product: CatalogProduct) => void
  statusBusyId: string | null
}

function CatalogProductNameCell({ row, table }: CellContext<CatalogProduct, unknown>) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const product = row.original
  const setup = useContext(ProductSetupContext)
  const { onEdit } = table.options.meta as CatalogProductsTableMeta
  const setupStatus = productItemStatus({
    name: product.name,
    isActive: product.isActive,
    price: product.price,
    audienceReady: product.visibility !== "Restricted",
    agendaReady: !setup.rentals || setup.linked[product.id] === true,
    menuPublished: setup.menuPublished,
  })
  const name = <>
    <span className="staff-catalog-product-icon"><Package size={20} aria-hidden="true" /></span>
    <span className="min-w-0">
      {can("catalog.products.manage") ? (
        <button type="button" className="touch-target staff-catalog-name-button" onClick={() => onEdit(product)}>
          <strong>{product.name}</strong>
        </button>
      ) : <strong>{product.name}</strong>}
      <ItemStatusBadge status={setupStatus} />
      {product.description ? <small className="staff-catalog-product-description">{product.description}</small> : null}
      <small className="staff-catalog-mobile-code">{product.code ?? "—"}</small>
      <Link className="staff-catalog-assistant-inline" to={productWizardPath(product.id)}>
        {t("catalog.productWizard.open")}
      </Link>
    </span>
  </>
  return <div className="staff-catalog-product-name">{name}</div>
}

function CatalogProductStatusCell({ row, table }: CellContext<CatalogProduct, unknown>) {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const product = row.original
  const { onToggleActive, statusBusyId } = table.options.meta as CatalogProductsTableMeta
  const status = <span className="staff-catalog-status" data-tone={product.isActive ? "success" : "muted"}>
    {t(product.isActive ? "catalog.products.active" : "catalog.products.inactive")}
  </span>
  return can("catalog.products.manage") ? (
    <button type="button" className="touch-target staff-catalog-status-button"
      aria-label={`${t(product.isActive ? "catalog.products.deactivate" : "catalog.products.activate")}: ${product.name}`}
      disabled={statusBusyId === product.id} aria-busy={statusBusyId === product.id}
      onClick={() => onToggleActive(product)}>{status}</button>
  ) : status
}

function CatalogProductActionsCell({ row, table }: CellContext<CatalogProduct, unknown>) {
  const { t } = useTranslation()
  const { onEdit, onToggleActive, statusBusyId } = table.options.meta as CatalogProductsTableMeta
  const product = row.original

  const quickEditLabel = t("catalog.products.quickEdit")
  const editLabel = t("common.edit")
  const activeLabel = product.isActive
    ? t("catalog.products.deactivate")
    : t("catalog.products.activate")

  return (
    <div className="staff-catalog-actions">
      <Link
        className="staff-catalog-assistant"
        to={productWizardPath(product.id)}
        aria-label={`${t("catalog.productWizard.open")}: ${product.name}`}
        title={t("catalog.productWizard.open")}
      >
        {t("catalog.productWizard.open")}
      </Link>
      <Can permission="catalog.products.manage">
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "icon" }), "staff-catalog-action")}
          aria-label={`${quickEditLabel}: ${product.name}`}
          title={quickEditLabel}
          to={productWizardPath(product.id, "offer")}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
        </Link>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="staff-catalog-action"
          aria-label={`${editLabel}: ${product.name}`}
          title={editLabel}
          onClick={() => onEdit(product)}
        >
          <Pencil size={16} aria-hidden="true" />
        </Button>
        <LoadingButton
          type="button"
          variant="outline"
          size="icon"
          className="staff-catalog-action"
          aria-label={`${activeLabel}: ${product.name}`}
          title={activeLabel}
          loading={statusBusyId === product.id}
          onClick={() => onToggleActive(product)}
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
