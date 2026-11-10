import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

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
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import {
  formatCatalogDate,
  type NotificationChannel,
  type NotificationDeliveryStatus,
} from "@/features/catalog/schemas/catalogSchemas"
import { deliveryErrorText } from "@/features/catalog/lib/deliveryErrorMessage"
import { DeliveryLogControls } from "@/features/notifications/components/DeliveryLogControls"
import { deliveryEventLabel } from "@/features/notifications/lib/deliveryEventLabel"
import type { NotificationDelivery } from "@/features/notifications/schemas/notificationDeliverySchemas"
import {
  listNotificationDeliveries,
  resendNotificationDelivery,
} from "@/features/notifications/services/notificationDeliveryService"

function dayBound(value: string, end: boolean): string | undefined {
  if (!value) return undefined
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

const NARROW_DELIVERY_QUERY = "(max-width: 767px)"

function useNarrowDeliveryList(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia?.(NARROW_DELIVERY_QUERY)
    media?.addEventListener("change", onChange)
    return () => media?.removeEventListener("change", onChange)
  }, [])
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(NARROW_DELIVERY_QUERY).matches ?? false,
    () => false,
  )
}

function DeliveryAttemptHistory({
  delivery,
  compact = false,
}: {
  delivery: NotificationDelivery
  compact?: boolean
}) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const attempts = [...(delivery.attempts ?? [])].sort((left, right) => left.attemptNumber - right.attemptNumber)

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
      ) : compact ? (
        <ul className="space-y-3">
          {attempts.map((attempt) => (
            <li key={attempt.attemptNumber} className="min-w-0 space-y-0.5 break-words text-sm">
              <p>
                {t("catalog.notifications.attemptColumns.number")} {attempt.attemptNumber}
                {" · "}
                {formatCatalogDate(attempt.finishedAt ?? attempt.startedAt, i18n.language, timeZoneId)}
              </p>
              <p>
                {t(`catalog.channels.${attempt.channel}`, { defaultValue: attempt.channel })}
                {" · "}
                {t(`catalog.notifications.attemptOutcome.${attempt.outcome}`)}
              </p>
              <p className="text-muted-foreground">
                {deliveryErrorText(attempt.errorMessage, t) ?? "—"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-[minmax(4.5rem,auto)_minmax(8rem,auto)_minmax(6rem,auto)_minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">{t("catalog.notifications.attemptColumns.number")}</span>
          <span className="font-medium">{t("catalog.notifications.attemptColumns.date")}</span>
          <span className="font-medium">{t("catalog.notifications.columns.channel")}</span>
          <span className="font-medium">{t("catalog.notifications.attemptColumns.outcome")}</span>
          <span className="font-medium">{t("catalog.notifications.attemptColumns.error")}</span>
          {attempts.map((attempt) => (
            <Fragment key={attempt.attemptNumber}>
              <span>{attempt.attemptNumber}</span>
              <span>{formatCatalogDate(attempt.finishedAt ?? attempt.startedAt, i18n.language, timeZoneId)}</span>
              <span>{t(`catalog.channels.${attempt.channel}`, { defaultValue: attempt.channel })}</span>
              <span>{t(`catalog.notifications.attemptOutcome.${attempt.outcome}`)}</span>
              <span className="break-words text-muted-foreground">
                {deliveryErrorText(attempt.errorMessage, t) ?? "—"}
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
  const canRead = can("core.notifications.read") || can("catalog.notifications.read")
  const canResend = can("core.notifications.resend") || can("catalog.notifications.resend")
  const narrow = useNarrowDeliveryList()

  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50>(20)
  const [totalCount, setTotalCount] = useState(0)
  const [status, setStatus] = useState<NotificationDeliveryStatus | "">("")
  const [channel, setChannel] = useState<NotificationChannel | "">("")
  const [event, setEvent] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [resendBusyIds, setResendBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null)
  const inFlightIds = useRef(new Set<string>())

  useEffect(() => {
    if (!canRead) {
      setLoading(false)
      setDeliveries([])
      return
    }
    let cancelled = false
    setLoading(true)
    void listNotificationDeliveries({
      page,
      pageSize,
      status: status || undefined,
      channel: channel || undefined,
      event: event || undefined,
      from: dayBound(from, false),
      to: dayBound(to, true),
    }).then((result) => {
      if (cancelled) return
      setDeliveries(result.items)
      setTotalCount(result.totalCount)
      setLoadError(null)
    }).catch((error: unknown) => {
      if (cancelled) return
      setLoadError(error instanceof Error ? error.message : t("apiErrors.loadCatalogNotifications"))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [canRead, channel, event, from, page, pageSize, status, t, to])

  const onResend = useCallback(async (id: string) => {
    if (inFlightIds.current.has(id)) {
      return
    }
    inFlightIds.current.add(id)
    setResendBusyIds(new Set(inFlightIds.current))
    try {
      const updated = await resendNotificationDelivery(id)
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
          deliveryErrorText(updated.errorMessage, t) || t("catalog.notifications.toastResendFailed"),
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

  const columns = useMemo<ColumnDef<NotificationDelivery>[]>(
    () => [
      {
        accessorKey: "eventKey",
        header: t("catalog.notifications.columns.event"),
        cell: ({ row }) => deliveryEventLabel(row.original.eventKey, t),
      },
      {
        accessorKey: "channel",
        header: t("catalog.notifications.columns.channel"),
        cell: ({ row }) => t(`catalog.channels.${row.original.channel}`),
      },
      {
        accessorKey: "recipientName",
        header: t("catalog.notifications.columns.recipient"),
        cell: ({ row }) =>
          row.original.recipientName ??
          t(`catalog.recipient.${row.original.recipientKind}`),
      },
      {
        accessorKey: "status",
        header: t("catalog.notifications.columns.status"),
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
        cell: ({ row }) => {
          const error = deliveryErrorText(row.original.errorMessage, t)
          return error
            ? <span className="block max-w-xs break-words text-sm text-muted-foreground">{error}</span>
            : "—"
        },
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
    getCoreRowModel: getCoreRowModel(),
  })

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

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

      {canRead ? (
      <>
      <DeliveryLogControls
        status={status}
        channel={channel}
        event={event}
        from={from}
        to={to}
        pageSize={pageSize}
        onStatus={(value) => { setStatus(value); setPage(1) }}
        onChannel={(value) => { setChannel(value); setPage(1) }}
        onEvent={(value) => { setEvent(value); setPage(1) }}
        onFrom={(value) => { setFrom(value); setPage(1) }}
        onTo={(value) => { setTo(value); setPage(1) }}
        onPageSize={(value) => { setPageSize(value); setPage(1) }}
      />
      {narrow ? (
          <div className="min-w-0 space-y-3">
            {loading ? (
              <div className="h-24 animate-pulse rounded-xl border border-border bg-muted/40" />
            ) : table.getRowModel().rows.length === 0 ? (
              <p className="rounded-xl border border-border px-3 py-8 text-center text-sm text-muted-foreground">
                {t("catalog.notifications.empty")}
              </p>
            ) : (
              table.getRowModel().rows.map((row) => {
                const delivery = row.original
                const showResend = delivery.status === "Failed"
                  && canResend
                  && delivery.canResend !== false
                const historyOpen = openHistoryId === delivery.id
                const error = deliveryErrorText(delivery.errorMessage, t)
                return (
                  <article
                    key={delivery.id}
                    aria-labelledby={`delivery-card-${delivery.id}`}
                    className="min-w-0 space-y-3 rounded-xl border border-border p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 id={`delivery-card-${delivery.id}`} className="break-words text-sm font-medium">
                          {deliveryEventLabel(delivery.eventKey, t)}
                        </h3>
                        <p className="break-words text-sm text-muted-foreground">
                          {t(`catalog.channels.${delivery.channel}`)}
                          {" · "}
                          {delivery.recipientName ?? t(`catalog.recipient.${delivery.recipientKind}`)}
                        </p>
                      </div>
                      <Badge variant={delivery.status === "Failed" ? "destructive" : "outline"}>
                        {t(`catalog.deliveryStatus.${delivery.status}`)}
                      </Badge>
                    </div>
                    <p className="break-words text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{t("catalog.notifications.columns.error")}: </span>
                      {error ?? "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCatalogDate(delivery.createdAt, i18n.language, timeZoneId)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-expanded={historyOpen}
                        aria-controls={`delivery-attempts-${delivery.id}`}
                        onClick={() => {
                          setOpenHistoryId((current) => current === delivery.id ? null : delivery.id)
                        }}
                      >
                        {t("catalog.notifications.attempts")}
                      </Button>
                      {showResend ? (
                        <LoadingButton
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={resendBusyIds.has(delivery.id)}
                          onClick={() => {
                            void onResend(delivery.id)
                          }}
                        >
                          {t("catalog.notifications.resend")}
                        </LoadingButton>
                      ) : null}
                    </div>
                    {historyOpen ? <DeliveryAttemptHistory delivery={delivery} compact /> : null}
                  </article>
                )
              })
            )}
          </div>
        ) : (
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
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("peopleAccess.pagination.summary", {
            from: totalCount === 0 ? 0 : (page - 1) * pageSize + 1,
            to: Math.min(page * pageSize, totalCount),
            total: totalCount,
          })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            {t("peopleAccess.pagination.previous")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("peopleAccess.pagination.next")}
          </Button>
        </div>
      </div>
      </>
      ) : null}
    </div>
  )
}
