import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { STAFF_ORDER_STATUS_TONE } from "../lib/catalogStatusBadge"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { Eye } from "lucide-react"
import { useTranslation } from "react-i18next"

import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatOrderTotalText } from "@/features/catalog/lib/catalogPriceSummary"
import {
  formatCatalogDate,
  type CatalogOrder,
} from "@/features/catalog/schemas/catalogSchemas"
import { listCatalogOrders } from "@/features/catalog/services/catalogService"
import { CatalogColumnFilter, CatalogEmptyState, CatalogHeading, CatalogSearch, CatalogTabs } from "@/features/catalog/components/StaffCatalogChrome"
import { TodayAgendaCard } from "@/features/catalog/components/agenda/TodayAgendaCard"


const ORDER_VIEWS = ["list", "agenda"] as const
type OrdersView = (typeof ORDER_VIEWS)[number]

export function CatalogOrdersPage() {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const view: OrdersView = searchParams.get("visao") === "agenda" ? "agenda" : "list"
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function selectView(next: OrdersView) {
    setSearchParams(
      (params) => {
        if (next === "agenda") {
          params.set("visao", "agenda")
        } else {
          params.delete("visao")
        }
        return params
      },
      { replace: true },
    )
  }

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const nextIndex = (index + delta + ORDER_VIEWS.length) % ORDER_VIEWS.length
    selectView(ORDER_VIEWS[nextIndex])
    tabRefs.current[nextIndex]?.focus()
  }
  const [orders, setOrders] = useState<CatalogOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void listCatalogOrders()
      .then((data) => {
        if (!cancelled) {
          setOrders(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : t("apiErrors.loadCatalogOrders"),
          )
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
  }, [t])

  const columns = useMemo<ColumnDef<CatalogOrder>[]>(
    () => [
      {
        accessorKey: "displayNumber",
        header: t("catalog.orders.columns.number"),
      },
      {
        accessorKey: "customerName",
        header: t("catalog.orders.columns.customer"),
        cell: ({ row }) => <span><span className="staff-catalog-mobile-label">{row.original.displayNumber} · </span>{row.original.customerName}</span>,
      },
      {
        accessorKey: "status",
        header: t("catalog.orders.columns.status"),
        cell: ({ row }) => (
          <span className="staff-catalog-status" data-tone={STAFF_ORDER_STATUS_TONE[row.original.status]}>
            {t(`catalog.status.${row.original.status}`)}
          </span>
        ),
        filterFn: (row, _columnId, filterValue) => {
          if (typeof filterValue !== "string" || filterValue.trim() === "") {
            return true
          }
          if (filterValue in STAFF_ORDER_STATUS_TONE) {
            return row.original.status === filterValue
          }
          return t(`catalog.status.${row.original.status}`)
            .toLowerCase()
            .includes(filterValue.trim().toLowerCase())
        },
      },
      {
        id: "total",
        accessorFn: (row) =>
          formatOrderTotalText(row, i18n.language, {
            onRequest: t("catalog.priceOnRequest"),
            partial: (amount) => t("catalog.knownPlusOnRequest", { amount }),
          }),
        header: t("catalog.orders.columns.total"),
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.orders.columns.createdAt"),
        enableColumnFilter: false,
        cell: ({ row }) => formatCatalogDate(row.original.createdAt, i18n.language, timeZoneId),
      },
      {
        id: "production",
        accessorFn: (row) => row.productionSummary,
        header: t("catalog.resourcePlanning.productionSummary.columnTitle"),
        enableColumnFilter: false,
        cell: ({ row }) =>
          row.original.productionSummary === "NotRequired" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span>
              {t(`catalog.resourcePlanning.productionSummary.status.${row.original.productionSummary}`)}
            </span>
          ),
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: t("catalog.orders.columns.actions"),
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigate(`/catalogo/pedidos/${row.original.id}`)
            }}
          >
            <Eye data-icon="inline-start" />
            {t("catalog.orders.view")}
          </Button>
        ),
      },
    ],
    [i18n.language, navigate, t, timeZoneId],
  )

  const table = useReactTable({
    data: orders,
    columns,
    state: { columnFilters, globalFilter: search },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setSearch,
    globalFilterFn: (row, _columnId, value: string) =>
      `${row.original.displayNumber} ${row.original.customerName}`.toLocaleLowerCase(i18n.language).includes(value.toLocaleLowerCase(i18n.language)),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="staff-catalog">
      <CatalogHeading
        title={t("catalog.orders.title")}
        description={t("catalog.orders.subtitle")}
      />

      <CatalogTabs active="orders" counts={loading || loadError ? {} : { orders: orders.length }} />

      <div role="tablist" aria-label={t("catalog.orders.title")} className="-mt-2 mb-4 flex gap-4 border-b border-border">
        {ORDER_VIEWS.map((key, index) => {
          const selected = view === key
          return (
            <button
              key={key}
              ref={(node) => { tabRefs.current[index] = node }}
              type="button"
              role="tab"
              id={`orders-view-tab-${key}`}
              aria-selected={selected}
              aria-controls={`orders-view-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectView(key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`-mb-px min-h-11 border-b-2 px-1 text-sm font-semibold transition-colors ${
                selected
                  ? "border-[var(--catalog-accent)] text-[var(--catalog-accent)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`catalog.orders.views.${key}`)}
            </button>
          )
        })}
      </div>

      {view === "agenda" ? (
        <div role="tabpanel" id="orders-view-panel-agenda" aria-labelledby="orders-view-tab-agenda">
          <TodayAgendaCard />
        </div>
      ) : (
      <div role="tabpanel" id="orders-view-panel-list" aria-labelledby="orders-view-tab-list">
      {!loading && !loadError && orders.length > 0 ? (
        <dl className="staff-catalog-kpis" aria-label={t("catalog.staff.orderSummary")}>
          {(["Requested", "Approved", "Preparing", "Ready"] as const).map((status) => (
            <div key={status} className="staff-catalog-card">
              <dt>{t(`catalog.staff.kpis.${status}`)}</dt>
              <dd>{orders.filter((order) => order.status === status).length}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {loadError ? (
        <Alert variant="destructive" className="staff-catalog-error">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="staff-catalog-card" aria-busy={loading}>
        <div className="staff-catalog-toolbar">
          <CatalogSearch value={search} onChange={setSearch} label={t("catalog.staff.ordersSearch")} placeholder={t("catalog.staff.ordersSearchShort")} />
          <CatalogColumnFilter column={table.getColumn("status")!} title={t("catalog.orders.columns.status")}
            options={Object.keys(STAFF_ORDER_STATUS_TONE).map((status) => ({ value: status, label: t(`catalog.status.${status}`) }))} />
          <CatalogColumnFilter column={table.getColumn("total")!} title={t("catalog.orders.columns.total")} />
        </div>
        {loading ? <span className="sr-only" role="status">{t("catalog.staff.loading")}</span> : null}
        {!loading && !loadError && table.getRowModel().rows.length === 0 ? <CatalogEmptyState kind="orders" filtered={orders.length > 0} /> : (
        <Table role="table" className="staff-catalog-table staff-catalog-orders-table" aria-label={t("catalog.orders.title")}>
          <TableHeader role="rowgroup">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow role="row" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead role="columnheader" key={header.id} data-column={header.column.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody role="rowgroup">
            {loading ? (
              <TableRowsSkeleton columns={6} rows={5} />
            ) : loadError ? null : (
              table.getRowModel().rows.map((row) => (
                <TableRow role="row" key={row.id} >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell role="cell" key={cell.id} data-column={cell.column.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        )}
      </div>
      </div>
      )}
    </div>
  )
}
