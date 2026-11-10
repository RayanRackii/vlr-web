import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { Button } from "@/components/ui/button"
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

function DeliveryAttemptHistory({
  delivery,
}: {
  delivery: CatalogNotificationDelivery
}) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const attempts = [...(delivery.attempts ?? [])].sort((left, right) => left.number - right.number)

  return (
    <section
      id={`delivery-attempts-${delivery.id}`}
      aria-label={t("catalog.notifications.attemptsTitle")}
      className="space-y-2 py-1"
    >
      {attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("catalog.notifications.attemptCount", { count: delivery.attemptCount })}
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(5rem,auto)_minmax(8rem,auto)_minmax(6rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">{t("catalog.notifications.attemptColumns.number")}</span>
          <span className="font-medium">{t("catalog.notifications.attemptColumns.date")}</span>
          <span className="font-medium">{t("catalog.notifications.columns.channel")}</span>
          <span className="font-medium">{t("catalog.notifications.attemptColumns.error")}</span>
          {attempts.map((attempt) => (
            <Fragment key={attempt.number}>
              <span>{attempt.number}</span>
              <span>{formatCatalogDate(attempt.timestamp, i18n.language, timeZoneId)}</span>
              <span>{t(`catalog.channels.${attempt.channel}`, { defaultValue: attempt.channel })}</span>
              <span className="break-words text-muted-foreground">
                {attempt.error?.trim() || "—"}
              </span>
            </Fragment>
          ))}
        </div>
      )}
    </section>
  )
}

export function CatalogNotificationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const { can } = usePermissions()
  const canResend = can("catalog.notifications.resend")

  const [deliveries, setDeliveries] = useState<CatalogNotificationDelivery[]>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [resendBusyIds, setResendBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null)
  const inFlightIds = useRef(new Set<string>())

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

  const onResend = useCallback(async (id: string) => {
    if (inFlightIds.current.has(id)) {
      return
    }
    inFlightIds.current.add(id)
    setResendBusyIds(new Set(inFlightIds.current))
    try {
      const updated = await resendCatalogNotification(id)
      setDeliveries((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      )
      if (updated.status === "Sending") {
        toast.message(t("catalog.notifications.toastResendSending"))
        return
      }
      if (updated.status === "Queued") {
        toast.success(t("catalog.notifications.toastResent"))
        return
      }
      if (updated.status === "Sent" || updated.status === "Delivered") {
        toast.success(t("catalog.notifications.toastResentSent"))
        return
      }
      toast.error(
        updated.errorMessage?.trim() || t("catalog.notifications.toastResendFailed"),
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.resendCatalogNotification"),
      )
    } finally {
      inFlightIds.current.delete(id)
      setResendBusyIds(new Set(inFlightIds.current))
    }
  }, [t])

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
        id: "errorMessage",
        accessorFn: (row) => row.errorMessage ?? "",
        header: t("catalog.notifications.columns.error"),
        enableColumnFilter: false,
        cell: ({ row }) => row.original.errorMessage?.trim()
          ? <span className="block max-w-xs break-words text-sm text-muted-foreground">{row.original.errorMessage}</span>
          : "—",
      },
      {
        accessorKey: "createdAt",
        header: t("catalog.notifications.columns.createdAt"),
        enableColumnFilter: false,
        cell: ({ row }) =>
          formatCatalogDate(row.original.createdAt, i18n.language, timeZoneId),
      },
      {
        id: "actions",
        enableColumnFilter: false,
        header: t("catalog.notifications.columns.actions"),
        cell: ({ row }) => {
          const showResend = row.original.status === "Failed"
            && canResend
            && row.original.canResend !== false
          const historyOpen = openHistoryId === row.original.id
          return (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-expanded={historyOpen}
                aria-controls={`delivery-attempts-${row.original.id}`}
                onClick={() => {
                  setOpenHistoryId((current) => current === row.original.id ? null : row.original.id)
                }}
              >
                {t("catalog.notifications.attempts")}
              </Button>
              {showResend ? (
                <LoadingButton
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={resendBusyIds.has(row.original.id)}
                  onClick={() => {
                    void onResend(row.original.id)
                  }}
                >
                  {t("catalog.notifications.resend")}
                </LoadingButton>
              ) : null}
            </div>
          )
        },
      },
    ],
    [canResend, i18n.language, onResend, openHistoryId, resendBusyIds, t, timeZoneId],
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
    <div
      id={embedded ? "entregas" : undefined}
      className={embedded ? "space-y-3" : "mx-auto w-full min-w-0 max-w-7xl space-y-8"}
    >
      <div className="space-y-1">
        {embedded ? (
          <h2 className="text-lg font-semibold">{t("notifications.settings.deliveries")}</h2>
        ) : (
          <h1 className="text-xl font-semibold tracking-tight">
            {t("catalog.notifications.title")}
          </h1>
        )}
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
                  <Fragment key={row.id}>
                    <TableRow>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {openHistoryId === row.original.id ? (
                      <TableRow>
                        <TableCell colSpan={row.getVisibleCells().length}>
                          <DeliveryAttemptHistory delivery={row.original} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Can>
    </div>
  )
}
