import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
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

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatCatalogDate,
  formatCatalogMoney,
  type CatalogOrder,
} from "@/features/catalog/schemas/catalogSchemas"
import { listCatalogOrders } from "@/features/catalog/services/catalogService"

export function CatalogOrdersPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<CatalogOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
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
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.orders.columns.number")}
          />
        ),
      },
      {
        accessorKey: "customerName",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.orders.columns.customer")}
          />
        ),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.orders.columns.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">
            {t(`catalog.status.${row.original.status}`)}
          </Badge>
        ),
        filterFn: (row, _columnId, filterValue) => {
          if (typeof filterValue !== "string" || filterValue.trim() === "") {
            return true
          }
          return t(`catalog.status.${row.original.status}`)
            .toLowerCase()
            .includes(filterValue.trim().toLowerCase())
        },
      },
      {
        id: "total",
        accessorFn: (row) =>
          formatCatalogMoney(row.totalAmount, row.currency, i18n.language) ??
          t("catalog.priceOnRequest"),
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.orders.columns.total")}
          />
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.orders.columns.createdAt"),
        enableColumnFilter: false,
        cell: ({ row }) => formatCatalogDate(row.original.createdAt, i18n.language),
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
    [i18n.language, navigate, t],
  )

  const table = useReactTable({
    data: orders,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("catalog.orders.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("catalog.orders.subtitle")}
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
          <TableBody>
            {loading ? (
              <TableRowsSkeleton columns={6} rows={5} />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {t("catalog.orders.empty")}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
      </div>
    </div>
  )
}
