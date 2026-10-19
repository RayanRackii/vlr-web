import { useEffect, useMemo, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { Eye } from "lucide-react"
import { useTranslation } from "react-i18next"

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
  portalProductRequestRange,
  productRequestStatusLabel,
} from "@/features/catalog/lib/productRequestStatusLabel"
import {
  formatCatalogDate,
  type PortalProductRequest,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  listPortalProductRequests,
  type PortalProductRequestListResult,
} from "@/features/catalog/services/catalogPortalService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { tenantPortalPath } from "@/features/tenantPortal/services/tenantPortalService"

export function PortalProductRequestsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { subdomain } = useOutletContext<CustomerAppOutletContext>()
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<PortalProductRequestListResult | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void listPortalProductRequests(page)
      .then((data) => {
        if (!cancelled) {
          setResult(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult(null)
          setLoadError(
            error instanceof Error
              ? error.message
              : i18n.t("apiErrors.loadPortalProductRequests"),
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
  }, [i18n, page, reloadKey])

  const columns = useMemo<ColumnDef<PortalProductRequest>[]>(
    () => [
      {
        accessorKey: "description",
        header: t("catalog.requests.columns.description"),
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-md whitespace-pre-wrap break-words">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "quantity",
        header: t("catalog.requests.columns.quantity"),
      },
      {
        accessorKey: "status",
        header: t("catalog.orders.columns.status"),
        cell: ({ row }) => (
          <Badge variant="outline">
            {productRequestStatusLabel(row.original.status, (key, options) =>
              t(key, options),
            )}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.requests.columns.createdAt"),
        cell: ({ row }) =>
          formatCatalogDate(row.original.createdAt, i18n.language),
      },
      {
        id: "actions",
        header: t("catalog.orders.columns.actions"),
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void navigate(
                tenantPortalPath(
                  subdomain,
                  `catalogo/solicitacoes/${row.original.id}`,
                ),
              )
            }}
          >
            <Eye data-icon="inline-start" />
            {t("catalog.orders.view")}
          </Button>
        ),
      },
    ],
    [i18n.language, navigate, subdomain, t],
  )

  const pageData = result?.kind === "ready" ? result.page : null
  const items = pageData?.items ?? []
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const range =
    pageData == null
      ? null
      : portalProductRequestRange(
          pageData.page,
          pageData.pageSize,
          pageData.total,
        )

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("tenantPortal.catalog.requestsTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.requestsSubtitle")}
        </p>
      </div>

      {loading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t("tenantPortal.catalog.requestsLoading")}
          className="rounded-xl border border-border"
        >
          <Table>
            <TableBody>
              <TableRowsSkeleton columns={5} rows={4} />
            </TableBody>
          </Table>
        </div>
      ) : loadError ? (
        <div role="alert" className="space-y-4">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true)
              setReloadKey((current) => current + 1)
            }}
          >
            {t("catalog.retry")}
          </Button>
        </div>
      ) : result?.kind === "unavailable" ? (
        <div role="status" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("tenantPortal.catalog.requestsUnavailable")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true)
              setReloadKey((current) => current + 1)
            }}
          >
            {t("catalog.retry")}
          </Button>
        </div>
      ) : pageData != null && pageData.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.catalog.requestsEmpty")}
        </p>
      ) : (
        <>
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
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      {t("tenantPortal.catalog.requestsPageEmpty")}
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
          {range != null && range.pageCount > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {t("tenantPortal.catalog.requestsPageSummary", {
                  from: range.from,
                  to: range.to,
                  total: pageData?.total ?? 0,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true)
                    setPage((current) => Math.max(1, current - 1))
                  }}
                >
                  {t("tenantPortal.catalog.requestsPrevious")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= range.pageCount}
                  onClick={() => {
                    setLoading(true)
                    setPage((current) => current + 1)
                  }}
                >
                  {t("tenantPortal.catalog.requestsNext")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
