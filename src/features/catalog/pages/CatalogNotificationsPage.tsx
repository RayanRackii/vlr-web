import { useEffect, useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { DataTableColumnFilterHeader } from "@/components/data-table/data-table-column-filter-header"
import { TableRowsSkeleton } from "@/components/loading/PageContentSkeleton"
import { Badge } from "@/components/ui/badge"
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
  catalogEventI18nKey,
  formatCatalogDate,
  type CatalogNotificationDelivery,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  listCatalogNotifications,
  resendCatalogNotification,
} from "@/features/catalog/services/catalogService"

export function CatalogNotificationsPage() {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canResend = can("catalog.notifications.resend")

  const [deliveries, setDeliveries] = useState<CatalogNotificationDelivery[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [resendBusyId, setResendBusyId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const nextDeliveries = await listCatalogNotifications()
      setDeliveries(nextDeliveries)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("apiErrors.loadCatalogNotifications"),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, [])

  async function onResend(id: string) {
    setResendBusyId(id)
    try {
      const updated = await resendCatalogNotification(id)
      setDeliveries((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      )
      toast.success(t("catalog.notifications.toastResent"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.resendCatalogNotification"),
      )
    } finally {
      setResendBusyId(null)
    }
  }

  const columns = useMemo<ColumnDef<CatalogNotificationDelivery>[]>(
    () => [
      {
        accessorKey: "eventType",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.notifications.columns.event")}
          />
        ),
        cell: ({ row }) =>
          t(catalogEventI18nKey(row.original.eventType), {
            defaultValue: row.original.eventType,
          }),
      },
      {
        accessorKey: "channel",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.notifications.columns.channel")}
          />
        ),
        cell: ({ row }) => t(`catalog.channels.${row.original.channel}`),
      },
      {
        accessorKey: "recipientName",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.notifications.columns.recipient")}
          />
        ),
        cell: ({ row }) =>
          row.original.recipientName ??
          t(`catalog.recipient.${row.original.recipientKind}`),
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnFilterHeader
            column={column}
            title={t("catalog.notifications.columns.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "Failed" ? "destructive" : "outline"
            }
          >
            {t(`catalog.deliveryStatus.${row.original.status}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.notifications.columns.createdAt"),
        enableColumnFilter: false,
        cell: ({ row }) =>
          formatCatalogDate(row.original.createdAt, i18n.language),
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: t("catalog.notifications.columns.actions"),
        cell: ({ row }) =>
          row.original.status === "Failed" && canResend ? (
            <LoadingButton
              type="button"
              size="sm"
              variant="outline"
              loading={resendBusyId === row.original.id}
              onClick={() => {
                void onResend(row.original.id)
              }}
            >
              {t("catalog.notifications.resend")}
            </LoadingButton>
          ) : null,
      },
    ],
    [canResend, i18n.language, resendBusyId, t],
  )

  const table = useReactTable({
    data: deliveries,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("catalog.notifications.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("catalog.notifications.subtitle")}
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      <Can permission="catalog.notifications.read">
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
                    {t("catalog.notifications.empty")}
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
      </Can>
    </div>
  )
}
