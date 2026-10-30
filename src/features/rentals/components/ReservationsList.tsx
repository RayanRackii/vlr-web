import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import {
  formatMoney,
  formatReservationAssets,
  formatReservationRange,
  type AdminReservation,
  type ReservationStatus,
} from "@/features/rentals/services/reservationsService"
import { formatTenantDate, formatTenantTime, tenantCivilDaySpan } from "@/lib/tenantTimeZone"

const statusVariant = {
  PendingDeposit: "warning",
  Confirmed: "info",
  Completed: "success",
  Canceled: "destructive",
} as const satisfies Record<ReservationStatus, string>

type ReservationsListProps = {
  rows: readonly AdminReservation[]
  dateLabel: string
  showDates: boolean
  actions: (row: AdminReservation) => ReactNode
}

/** One set of rows and actions: the table becomes a card grid on smaller screens. */
export function ReservationsList({ rows, dateLabel, showDates, actions }: ReservationsListProps) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()

  return (
    <section className="reservations-surface reservations-list" aria-label={t("rentals.reservations.title")}>
      <div className="reservations-list-heading">
        <p><strong>{t("rentals.reservations.count", { count: rows.length })}</strong>{dateLabel && <> · {dateLabel}</>}</p>
        <span>{t("rentals.reservations.orderedByTime")}</span>
      </div>
      <table className="reservations-table" role="table" aria-label={t("rentals.reservations.title")}>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">{t("rentals.reservations.time")}</th>
            <th scope="col" role="columnheader">{t("rentals.reservations.customer")}</th>
            <th scope="col" role="columnheader" className="reservations-resource-column">{t("rentals.reservations.resources")}</th>
            <th scope="col" role="columnheader">{t("rentals.reservations.status")}</th>
            <th scope="col" role="columnheader" className="reservations-number">{t("rentals.reservations.total")}</th>
            <th scope="col" role="columnheader" className="reservations-number">{t("rentals.reservations.actions")}</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => {
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
            const rowActions = actions(row)

            return (
              <tr key={row.id} role="row" className="reservation-row" data-status={row.status}>
                <td role="cell" className="reservation-time">
                  <span className="reservation-time-range">
                    {showDates && !multiDay && <small>{formatTenantDate(start, timeZoneId, i18n.language)}</small>}
                    {multiDay ? formatReservationRange(row.startDateTime, row.endDateTime, timeZoneId) : <>{formatTenantTime(start, timeZoneId, i18n.language)} – {formatTenantTime(end, timeZoneId, i18n.language)}</>}
                  </span>
                  <small className="reservation-duration">{duration}</small>
                </td>
                <td role="cell" className="reservation-customer">
                  <div className="reservation-customer-details">
                    <span className="reservation-avatar" aria-hidden="true">{initials}</span>
                    <div className="min-w-0">
                      <strong>{row.customerName}</strong>
                      <p className="reservation-compact-resources">{formatReservationAssets(row)}</p>
                    </div>
                  </div>
                </td>
                <td role="cell" className="reservations-resource-column reservation-resources">{formatReservationAssets(row)}</td>
                <td role="cell" className="reservation-status">
                  <Badge variant={statusVariant[row.status]} className="reservation-status-badge">
                    <span className="reservation-status-dot" aria-hidden="true" />
                    {t(`rentals.reservations.statuses.${row.status}`)}
                  </Badge>
                </td>
                <td role="cell" className="reservation-total">{formatMoney(row.totalAmount)}</td>
                <td role="cell" className="reservation-actions-cell">
                  {rowActions ? <div className="reservation-actions">{rowActions}</div> : <span className="reservation-no-actions" aria-label={t("rentals.reservations.noActions")}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
