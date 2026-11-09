import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addCivilDays,
  formatCivilDay,
  groupByCivilDate,
  mondayOfWeek,
  reservationMatchesResource,
  weekDays,
} from "@/features/rentals/components/resourceWizard/weekBookings"
import {
  formatReservationRange,
  listAdminReservations,
  type AdminReservation,
} from "@/features/rentals/services/reservationsService"
import {
  fetchStaffResourceQueue,
  type StaffQueueRead,
} from "@/features/rentals/services/staffResourceQueueService"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"

type ResourceWizardAgendaStepProps = {
  asset: AdminRentalAsset
  canReadReservations: boolean
  onOpenPrices: () => void
}

export function ResourceWizardAgendaStep({
  asset,
  canReadReservations,
  onOpenPrices,
}: ResourceWizardAgendaStepProps) {
  const { t, i18n } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const [anchor, setAnchor] = useState(() => tenantTodayIsoDate(timeZoneId))
  const [rows, setRows] = useState<AdminReservation[]>([])
  const [loading, setLoading] = useState(canReadReservations)
  const [loadError, setLoadError] = useState(false)
  const [weekRequest, setWeekRequest] = useState(0)
  const [queue, setQueue] = useState<StaffQueueRead | null>(null)
  const [queueLoading, setQueueLoading] = useState(
    canReadReservations && asset.type === "Location" && asset.queueEnabled,
  )
  const [queueRequest, setQueueRequest] = useState(0)
  const monday = mondayOfWeek(anchor)
  const weekEnd = addCivilDays(monday, 6)
  const days = weekDays(monday)
  const grouped = groupByCivilDate(
    rows.filter((row) => reservationMatchesResource(row, asset.id, asset.assetId)),
    timeZoneId,
  )
  const queueEnabled = asset.type === "Location" && asset.queueEnabled

  useEffect(() => {
    if (!canReadReservations) {
      return
    }
    let cancelled = false
    void listAdminReservations({ from: monday, to: weekEnd })
      .then((items) => {
        if (!cancelled) {
          setRows(items)
          setLoadError(false)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [canReadReservations, monday, weekEnd, weekRequest])

  useEffect(() => {
    if (!canReadReservations || !queueEnabled) {
      return
    }
    let cancelled = false
    void fetchStaffResourceQueue(asset.id, tenantTodayIsoDate(timeZoneId))
      .then((result) => {
        if (!cancelled) {
          setQueue(result)
          setQueueLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQueue({ status: "unavailable" })
          setQueueLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [asset.id, canReadReservations, queueEnabled, queueRequest, timeZoneId])

  function showWeek(nextAnchor: string) {
    if (mondayOfWeek(nextAnchor) === monday) {
      return
    }
    setLoading(true)
    setLoadError(false)
    setAnchor(nextAnchor)
  }

  return (
    <section className="space-y-4" aria-labelledby="wizard-agenda-title">
      <div>
        <h2 id="wizard-agenda-title" className="text-lg font-semibold">
          {t("rentals.resourceWizard.agenda.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("rentals.resourceWizard.agenda.description")}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => showWeek(addCivilDays(monday, -7))}>
          {t("rentals.resourceWizard.agenda.previous")}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => showWeek(tenantTodayIsoDate(timeZoneId))}>
          {t("rentals.resourceWizard.agenda.today")}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => showWeek(addCivilDays(monday, 7))}>
          {t("rentals.resourceWizard.agenda.next")}
        </Button>
      </div>
      <p className="text-sm font-medium">
        {formatCivilDay(monday, i18n.language)} – {formatCivilDay(weekEnd, i18n.language)}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <div className="min-w-0 space-y-2">
          {!canReadReservations ? (
            <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm" role="status">
              {t("rentals.resourceWizard.permission")}
            </p>
          ) : loading ? (
            <Skeleton className="h-40 w-full" aria-label={t("common.loading")} />
          ) : loadError ? (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">{t("rentals.resourceWizard.agenda.loadError")}</p>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => {
                setLoading(true)
                setLoadError(false)
                setWeekRequest((current) => current + 1)
              }}>
                {t("rentals.resourceWizard.agenda.retry")}
              </Button>
            </div>
          ) : (
            <ol className="space-y-2">
              {days.map((day) => {
                const bookings = grouped.get(day) ?? []
                return (
                  <li key={day} className="rounded-xl border border-border p-3">
                    <p className="text-sm font-medium">{formatCivilDay(day, i18n.language)}</p>
                    {bookings.length === 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{t("rentals.resourceWizard.agenda.emptyDay")}</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {bookings.map((booking) => (
                          <li key={booking.id} className="text-sm">
                            <span className="font-medium">{booking.customerName}</span>
                            {" · "}
                            {formatReservationRange(booking.startDateTime, booking.endDateTime, timeZoneId)}
                            {" · "}
                            {t(`rentals.reservations.statuses.${booking.status}`)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
        <QueuePanel
          asset={asset}
          canRead={canReadReservations}
          loading={queueLoading}
          queue={queue}
          onRefresh={() => {
            setQueueLoading(true)
            setQueueRequest((current) => current + 1)
          }}
          onOpenPrices={onOpenPrices}
        />
      </div>
    </section>
  )
}

function QueuePanel({
  asset,
  canRead,
  loading,
  queue,
  onRefresh,
  onOpenPrices,
}: {
  asset: AdminRentalAsset
  canRead: boolean
  loading: boolean
  queue: StaffQueueRead | null
  onRefresh: () => void
  onOpenPrices: () => void
}) {
  const { t } = useTranslation()

  return (
    <aside className="min-w-0 space-y-3 rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold">{t("rentals.resourceWizard.agenda.queueTitle")}</h3>
      {!canRead ? (
        <p className="text-sm" role="status">{t("rentals.resourceWizard.agenda.queueForbidden")}</p>
      ) : asset.type !== "Location" ? (
        <p className="text-sm text-muted-foreground">{t("rentals.resourceWizard.details.queue.notApplicable")}</p>
      ) : !asset.queueEnabled ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("rentals.resourceWizard.agenda.queueOff")}</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={onOpenPrices}>
            {t("rentals.resourceWizard.actions.openStep")}
          </Button>
        </div>
      ) : loading || queue === null ? (
        <Skeleton className="h-24 w-full" aria-label={t("common.loading")} />
      ) : queue.status === "forbidden" ? (
        <p className="text-sm" role="status">{t("rentals.resourceWizard.agenda.queueForbidden")}</p>
      ) : queue.status === "unavailable" ? (
        <p className="text-sm" role="status">{t("rentals.resourceWizard.agenda.queueUnavailable")}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm">
            {t(`rentals.resourceWizard.agenda.phase.${queue.queue.phase}`)}
            {" · "}
            {t("rentals.resourceWizard.agenda.waiting", { count: queue.queue.waitingCount })}
          </p>
          {queue.queue.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("rentals.resourceWizard.agenda.queueEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {queue.queue.tickets.map((ticket) => (
                <li key={ticket.id} className="text-sm">
                  <span className="font-medium">{ticket.customerName?.trim() || t("rentals.resourceWizard.agenda.unknownCustomer")}</span>
                  {" · "}
                  {t("rentals.resourceWizard.agenda.position", { position: ticket.position })}
                  {" · "}
                  {t(`rentals.resourceWizard.agenda.ticketStatus.${ticket.status}`)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {canRead && asset.type === "Location" && asset.queueEnabled ? (
        <Button type="button" variant="outline" className="min-h-11" onClick={onRefresh}>
          {t("rentals.resourceWizard.agenda.queueRefresh")}
        </Button>
      ) : null}
    </aside>
  )
}
