import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { StatusBadge } from "@/components/ui/status"
import type { EmptyStateProps } from "@/components/ui/empty-state"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import {
  formatMoney,
  formatReservationAssets,
  formatReservationRange,
  type AdminReservation,
} from "@/features/rentals/services/reservationsService"
import { reservationStatusTone } from "@/features/rentals/lib/reservationStatusTone"
import { formatTenantDate, formatTenantTime, tenantCivilDaySpan } from "@/lib/tenantTimeZone"

type ReservationsListProps = {
  rows: readonly AdminReservation[]
  dateLabel: string
  showDates: boolean
  actions: (row: AdminReservation) => ReactNode
  toolbar?: ReactNode
  empty: EmptyStateProps
  loadingLabel?: string
} & (
  | { state?: "ready" | "loading"; error?: undefined; onRetry?: undefined }
  | { state: "error"; error: string; onRetry: () => void }
)

/** One set of rows and actions through DataList: a table from md, cards below. */
export function ReservationsList({ rows, dateLabel, showDates, actions, toolbar, empty, loadingLabel, ...stateProps }: ReservationsListProps) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()

  function describe(row: AdminReservation) {
    const start = new Date(row.startDateTime)
    const end = new Date(row.endDateTime)
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
    const duration = minutes % 60 === 0
      ? t("rentals.reservations.durationHours", { hours: minutes / 60 })
      : minutes < 60
        ? t("rentals.reservations.durationMinutes", { minutes })
        : t("rentals.reservations.durationHoursMinutes", { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
    const multiDay = tenantCivilDaySpan(row.startDateTime, row.endDateTime, timeZoneId) > 1
    const initials = row.customerName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("")
    const range = multiDay
      ? formatReservationRange(row.startDateTime, row.endDateTime, timeZoneId)
      : `${formatTenantTime(start, timeZoneId, i18n.language)} – ${formatTenantTime(end, timeZoneId, i18n.language)}`
    const day = showDates && !multiDay ? formatTenantDate(start, timeZoneId, i18n.language) : null
    return { duration, initials, range, day }
  }

  function statusBadge(row: AdminReservation) {
    return <StatusBadge tone={reservationStatusTone[row.status]}>{t(`rentals.reservations.statuses.${row.status}`)}</StatusBadge>
  }

  function actionsNode(row: AdminReservation, labelled: boolean) {
    const node = actions(row)
    return node
      ? <div className="reservation-actions flex flex-wrap justify-end gap-2">{node}</div>
      : labelled
        ? <span className="text-muted-foreground" aria-label={t("rentals.reservations.noActions")}>—</span>
        : null
  }

  const columns: DataListColumn<AdminReservation>[] = [
    {
      id: "time",
      header: t("rentals.reservations.time"),
      className: "tabular-nums",
      cell: (row) => {
        const { range, day, duration } = describe(row)
        return (
          <>
            <span className="block font-semibold">
              {day && <small className="block text-xs font-normal text-muted-foreground">{day}</small>}
              {range}
            </span>
            <small className="block text-xs text-muted-foreground">{duration}</small>
          </>
        )
      },
    },
    {
      id: "customer",
      header: t("rentals.reservations.customer"),
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground" aria-hidden="true">{describe(row).initials}</span>
          <div className="min-w-0">
            <strong className="break-words font-semibold">{row.customerName}</strong>
            <p className="text-sm text-muted-foreground break-words lg:hidden">{formatReservationAssets(row)}</p>
          </div>
        </div>
      ),
    },
    {
      id: "resources",
      header: t("rentals.reservations.resources"),
      hideBelow: "lg",
      className: "text-muted-foreground break-words",
      cell: (row) => formatReservationAssets(row),
    },
    { id: "status", header: t("rentals.reservations.status"), cell: statusBadge },
    {
      id: "total",
      header: t("rentals.reservations.total"),
      align: "end",
      className: "whitespace-nowrap font-bold tabular-nums",
      cell: (row) => formatMoney(row.totalAmount),
    },
    {
      id: "actions",
      header: t("rentals.reservations.actions"),
      align: "end",
      cell: (row) => actionsNode(row, true),
    },
  ]

  return (
    <DataList<AdminReservation>
      {...stateProps}
      label={t("rentals.reservations.title")}
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      rowAttributes={(row) => ({ "data-status": row.status })}
      toolbar={toolbar}
      empty={empty}
      loadingLabel={loadingLabel}
      heading={
        <>
          <p><strong className="font-semibold text-foreground">{t("rentals.reservations.count", { count: rows.length })}</strong>{dateLabel && <> · {dateLabel}</>}</p>
          <span className="hidden shrink-0 sm:inline">{t("rentals.reservations.orderedByTime")}</span>
        </>
      }
      renderCard={(row) => {
        const { range, day, duration, initials } = describe(row)
        return (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-semibold tabular-nums">
                {day && <small className="block text-xs font-normal text-muted-foreground">{day}</small>}
                {range}
              </span>
              {statusBadge(row)}
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground" aria-hidden="true">{initials}</span>
              <div className="min-w-0">
                <strong className="break-words font-semibold">{row.customerName}</strong>
                <p className="text-sm text-muted-foreground break-words">{formatReservationAssets(row)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <small className="text-muted-foreground">{duration}</small>
              <span className="font-bold tabular-nums">{formatMoney(row.totalAmount)}</span>
            </div>
            {actionsNode(row, false)}
          </>
        )
      }}
    />
  )
}
