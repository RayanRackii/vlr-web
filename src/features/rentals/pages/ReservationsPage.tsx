import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { LocaleDateInput } from "@/components/LocaleDateInput"
import { toast } from "sonner"

import { AlertTriangle, CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingButton } from "@/components/ui/loading-button"
import { Skeleton } from "@/components/ui/skeleton"
import { ReservationsHeader } from "@/features/rentals/components/ReservationsHeader"
import { ReservationsList } from "@/features/rentals/components/ReservationsList"
import "./reservations.css"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import { usePermissions } from "@/features/users/permissions/PermissionContext"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import {
  cancelAdminReservation,
  completeAdminReservation,
  confirmAdminReservation,
  formatMoney,
  formatReservationAssets,
  formatReservationRange,
  listAdminReservations,
  reservationStatuses,
  type AdminReservation,
  type ReservationStatus,
} from "@/features/rentals/services/reservationsService"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { cn } from "@/lib/utils"

type ReservationsView = "day" | "week" | "month"

/** Civil yyyy-mm-dd from local date parts (no UTC conversion). */
function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Monday-start week containing the anchor date, noon-anchored to dodge DST day shifts. */
function startOfWeek(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  const sinceMonday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - sinceMonday)
  return toIso(date)
}

function endOfWeek(iso: string): string {
  const date = new Date(`${startOfWeek(iso)}T12:00:00`)
  date.setDate(date.getDate() + 6)
  return toIso(date)
}

function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

function endOfMonth(iso: string): string {
  const date = new Date(`${startOfMonth(iso)}T12:00:00`)
  date.setMonth(date.getMonth() + 1)
  date.setDate(0)
  return toIso(date)
}

type ReservationsPageProps = {
  showHeader?: boolean
  onDateChange?: (date: string) => void
}

export function ReservationsPage({ showHeader = true, onDateChange }: ReservationsPageProps) {
  const { t, i18n } = useTranslation()
  const { can } = usePermissions()
  const timeZoneId = useTenantTimeZone()
  const { isTrialReadOnly } = useTrialStatus()
  const [date, setDate] = useState(() => tenantTodayIsoDate(timeZoneId))
  const [view, setView] = useState<ReservationsView>("day")
  const [status, setStatus] = useState<ReservationStatus | "">("")
  const [rows, setRows] = useState<AdminReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AdminReservation | null>(null)

  const requestSeq = useRef(0)
  const dateId = useId()
  const [loadError, setLoadError] = useState(false)
  const sortedRows = useMemo(() => [...rows].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)), [rows])

  useEffect(() => { onDateChange?.(date) }, [date, onDateChange])

  function shiftDay(delta: number) {
    const anchor = new Date(`${date || tenantTodayIsoDate(timeZoneId)}T12:00:00`)
    anchor.setDate(anchor.getDate() + delta)
    setDate(toIso(anchor))
  }

  const range = useMemo(() => {
    if (!date) {
      return { from: undefined, to: undefined }
    }
    if (view === "week") {
      return { from: startOfWeek(date), to: endOfWeek(date) }
    }
    if (view === "month") {
      return { from: startOfMonth(date), to: endOfMonth(date) }
    }
    return { from: date, to: date }
  }, [date, view])

  const load = useCallback(async (options?: { keepRows?: boolean }) => {
    const seq = ++requestSeq.current
    setLoading(true)
    setLoadError(false)
    if (!options?.keepRows) {
      setRows([])
    }
    try {
      const items = await listAdminReservations({
        from: range.from,
        to: range.to,
        status,
      })
      if (seq !== requestSeq.current) return
      setRows(items)
    } catch (error) {
      if (seq !== requestSeq.current) return
      setLoadError(true)
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.reservations.loadError"),
      )
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [range.from, range.to, status, t])

  useEffect(() => {
    void load()
  }, [load])

  async function onConfirm(id: string) {
    setBusyId(id)
    try {
      await confirmAdminReservation(id)
      toast.success(t("rentals.reservations.confirmSuccess"))
      await load({ keepRows: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.reservations.confirmError"),
      )
    } finally {
      setBusyId(null)
    }
  }

  async function onCancel(id: string) {
    setBusyId(id)
    try {
      await cancelAdminReservation(id)
      toast.success(t("rentals.reservations.cancelSuccess"))
      setCancelTarget(null)
      await load({ keepRows: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.reservations.cancelError"),
      )
    } finally {
      setBusyId(null)
    }
  }

  async function onComplete(id: string) {
    setBusyId(id)
    try {
      await completeAdminReservation(id)
      toast.success(t("rentals.reservations.completeSuccess"))
      await load({ keepRows: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.reservations.completeError"),
      )
    } finally {
      setBusyId(null)
    }
  }

  function rowActions(row: AdminReservation) {
    const canConfirm = row.status === "PendingDeposit"
    const canComplete = row.status === "Confirmed" && can("rentals.reservations.complete")
    const canCancel = row.status === "PendingDeposit" || row.status === "Confirmed"
    if (!canConfirm && !canComplete && !canCancel) return null

    return (
      <>
        {canConfirm && (
          <LoadingButton size="sm" loading={busyId === row.id} disabled={isTrialReadOnly} onClick={() => { void onConfirm(row.id) }}>
            {t("rentals.reservations.confirm")}
          </LoadingButton>
        )}
        {canComplete && (
          <LoadingButton size="sm" loading={busyId === row.id} disabled={isTrialReadOnly} onClick={() => { void onComplete(row.id) }}>
            {t("rentals.reservations.complete")}
          </LoadingButton>
        )}
        {canCancel && (
          <LoadingButton size="sm" variant="outline" className="reservation-cancel" loading={busyId === row.id} disabled={isTrialReadOnly} onClick={() => { setCancelTarget(row) }}>
            {t("rentals.reservations.cancel")}
          </LoadingButton>
        )}
      </>
    )
  }

  const dateLabel = date ? new Intl.DateTimeFormat(i18n.language, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(`${date}T12:00:00`)) : ""
  const listDateLabel = view === "day" ? dateLabel : range.from && range.to
    ? `${new Intl.DateTimeFormat(i18n.language).format(new Date(`${range.from}T12:00:00`))} – ${new Intl.DateTimeFormat(i18n.language).format(new Date(`${range.to}T12:00:00`))}`
    : ""

  return (
    <div className={cn("reservations-page", showHeader && "reservations-layout")}>
      {showHeader && <ReservationsHeader date={date || undefined} />}
      {isTrialReadOnly && (
        <Alert variant="warning" role="status" className="reservations-trial">
          <AlertTriangle size={20} aria-hidden="true" />
          <AlertDescription>{t("trial.readOnlyHint")}</AlertDescription>
        </Alert>
      )}

      <section className="reservations-surface reservations-filters" aria-label={t("rentals.reservations.filters")}>
        <div className="reservations-filter-bar">
          <div role="group" aria-label={t("rentals.reservations.period")} className="reservations-segment">
            {(["day", "week", "month"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>
                {t(`rentals.reservations.view${value[0].toUpperCase()}${value.slice(1)}`)}
              </button>
            ))}
          </div>
          <div className="reservations-date">
            <Button variant="ghost" size="icon" aria-label={t("rentals.reservations.previousDay")} onClick={() => shiftDay(-1)}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <CalendarDays size={18} aria-hidden="true" className="reservations-date-icon" />
            <label htmlFor={dateId} className="sr-only">{t("rentals.reservations.date")}</label>
            <LocaleDateInput id={dateId} value={date} locale={i18n.language} today={tenantTodayIsoDate(timeZoneId)} className="reservations-date-input" onChange={setDate} />
            <Button variant="ghost" size="icon" aria-label={t("rentals.reservations.nextDay")} onClick={() => shiftDay(1)}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <Button variant="outline" className="reservations-today" onClick={() => setDate(tenantTodayIsoDate(timeZoneId))}>
            {t("rentals.reservations.today")}
          </Button>
        </div>
        <fieldset className="reservations-chips">
          <legend className="sr-only">{t("rentals.reservations.status")}</legend>
          {[
            { value: "" as const, label: t("rentals.reservations.statusAll") },
            ...reservationStatuses.map((value) => ({ value, label: t(`rentals.reservations.statuses.${value}`) })),
          ].map((option) => (
            <button key={option.value || "all"} type="button" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}>
              {option.value && <span className="reservation-filter-dot" data-status={option.value} aria-hidden="true" />}
              {option.label}
            </button>
          ))}
        </fieldset>
      </section>

      <div aria-busy={loading} className="reservations-results">
        {loadError && !loading && (
          <Alert variant="destructive" role="alert" className="reservations-error">
            <AlertTriangle size={20} aria-hidden="true" />
            <AlertDescription>{t("rentals.reservations.loadError")}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <section className="reservations-surface reservations-loading" role="status" aria-label={t("rentals.reservations.loading")}>
            <div className="reservations-list-heading">{t("rentals.reservations.loading")}</div>
            {[0, 1, 2].map((row) => (
              <div key={row} className="reservations-skeleton-row" aria-hidden="true">
                <Skeleton /><Skeleton /><Skeleton /><Skeleton />
              </div>
            ))}
          </section>
        ) : loadError && sortedRows.length === 0 ? null : sortedRows.length === 0 ? (
          <EmptyState icon={CalendarRange} className="reservations-surface reservations-empty" title={t("rentals.reservations.empty")} description={t("rentals.reservations.emptyDescription")} action={
            <Button variant="outline" className="reservations-today" onClick={() => { setDate(tenantTodayIsoDate(timeZoneId)) }}>
              {t("rentals.reservations.goToday")}
            </Button>
          } />
        ) : (
          <ReservationsList rows={sortedRows} dateLabel={listDateLabel} showDates={view !== "day" || !date} actions={rowActions} />
        )}
      </div>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setCancelTarget(null)
        }}
      >
        <AlertDialogContent className="reservations-cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rentals.reservations.cancelConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rentals.reservations.cancelConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelTarget ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{cancelTarget.customerName}</p>
              <p className="text-muted-foreground">
                {formatReservationAssets(cancelTarget)}
              </p>
              <p className="text-muted-foreground">
                {formatReservationRange(
                  cancelTarget.startDateTime,
                  cancelTarget.endDateTime,
                  timeZoneId,
                )}
              </p>
              <p className="font-semibold text-foreground">
                {t("rentals.reservations.cancelConfirmTotal", {
                  amount: formatMoney(cancelTarget.totalAmount),
                })}
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelTarget !== null && busyId === cancelTarget.id}>
              {t("rentals.reservations.cancelConfirmDismiss")}
            </AlertDialogCancel>
            <LoadingButton
              variant="destructive"
              disabled={isTrialReadOnly}
              loading={cancelTarget !== null && busyId === cancelTarget.id}
              onClick={() => {
                if (cancelTarget) void onCancel(cancelTarget.id)
              }}
            >
              {t("rentals.reservations.cancelConfirmAction")}
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
