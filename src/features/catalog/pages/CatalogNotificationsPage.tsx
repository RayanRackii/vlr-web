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
import { Checkbox } from "@/components/ui/checkbox"
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
  CATALOG_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  formatCatalogDate,
  type CatalogChannelConfig,
  type CatalogNotificationDelivery,
  type NotificationChannel,
} from "@/features/catalog/schemas/catalogSchemas"
import {
  listCatalogNotificationChannels,
  listCatalogNotifications,
  resendCatalogNotification,
  upsertCatalogNotificationChannel,
} from "@/features/catalog/services/catalogService"

function isChannelActive(
  configs: readonly CatalogChannelConfig[],
  eventType: string,
  channel: NotificationChannel,
): boolean {
  return configs.some(
    (item) =>
      item.eventType === eventType &&
      item.channel === channel &&
      item.isActive,
  )
}

export function CatalogNotificationsPage() {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const canResend = can("catalog.notifications.resend")

  const [deliveries, setDeliveries] = useState<CatalogNotificationDelivery[]>(
    [],
  )
  const [channels, setChannels] = useState<CatalogChannelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [resendBusyId, setResendBusyId] = useState<string | null>(null)
  const [channelBusyKey, setChannelBusyKey] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    try {
      const [nextDeliveries, nextChannels] = await Promise.all([
        listCatalogNotifications(),
        listCatalogNotificationChannels(),
      ])
      setDeliveries(nextDeliveries)
      setChannels(nextChannels)
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

  async function onToggleChannel(
    eventType: string,
    channel: NotificationChannel,
    isActive: boolean,
  ) {
    if (channel === "Sms") {
      return
    }
    const key = `${eventType}:${channel}`
    setChannelBusyKey(key)
    try {
      const updated = await upsertCatalogNotificationChannel({
        eventType,
        channel,
        isActive,
      })
      setChannels((current) => {
        const without = current.filter(
          (item) =>
            !(item.eventType === eventType && item.channel === channel),
        )
        return [...without, updated]
      })
      toast.success(t("catalog.notifications.toastChannelSaved"))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.saveCatalogChannel"),
      )
    } finally {
      setChannelBusyKey(null)
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
          t(`catalog.events.${row.original.eventType}`, {
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

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">
            {t("catalog.notifications.channelsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("catalog.notifications.channelsSubtitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("catalog.notifications.smsUnavailable")}
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("catalog.notifications.columns.event")}</TableHead>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <TableHead key={channel}>
                    {t(`catalog.channels.${channel}`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATALOG_EVENT_TYPES.map((eventType) => (
                <TableRow key={eventType}>
                  <TableCell>
                    {t(`catalog.events.${eventType}`, {
                      defaultValue: eventType,
                    })}
                  </TableCell>
                  {NOTIFICATION_CHANNELS.map((channel) => {
                    const checked = isChannelActive(
                      channels,
                      eventType,
                      channel,
                    )
                    const key = `${eventType}:${channel}`
                    const sms = channel === "Sms"
                    return (
                      <TableCell key={channel}>
                        <Checkbox
                          checked={checked}
                          disabled={
                            sms ||
                            !canResend ||
                            channelBusyKey === key ||
                            loading
                          }
                          aria-label={t("catalog.notifications.toggleChannel", {
                            event: t(`catalog.events.${eventType}`, {
                              defaultValue: eventType,
                            }),
                            channel: t(`catalog.channels.${channel}`),
                          })}
                          onChange={(event) => {
                            void onToggleChannel(
                              eventType,
                              channel,
                              event.target.checked,
                            )
                          }}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

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
