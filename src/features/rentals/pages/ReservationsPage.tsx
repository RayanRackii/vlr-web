import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AlertTriangle, CalendarRange } from "lucide-react"

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
import { FilterBar } from "@/components/data-table/FilterBar"
import { StatusChips } from "@/components/data-table/StatusChips"
import { DateNavigator } from "@/components/ui/date-navigator"
import { useModuleIntroLink } from "@/hooks/useModuleIntroLink"
import { LoadingButton } from "@/components/ui/loading-button"
import { ReservationsHeader } from "@/features/rentals/components/ReservationsHeader"
import { ReservationsList } from "@/features/rentals/components/ReservationsList"
import { reservationStatusTone } from "@/features/rentals/lib/reservationStatusTone"
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

function countByStatus(rows: readonly AdminReservation[]): Record<ReservationStatus, number> {
  const counts = Object.fromEntries(reservationStatuses.map((value) => [value, 0])) as Record<ReservationStatus, number>
  for (const row of rows) counts[row.status] += 1
  return counts
}

function addDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T12:00:00`)
  date.setDate(date.getDate() + delta)
  return toIso(date)
}

/** Adds months clamping the day to the target month length (31 Jan + 1 month = 28/29 Feb). */
function addMonths(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number)
  const target = new Date(year, month - 1 + delta, 1, 12)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate()
  target.setDate(Math.min(day, lastDay))
  return toIso(target)
}

function stepDate(iso: string, view: ReservationsView, direction: -1 | 1): string {
  if (view === "week") return addDays(iso, 7 * direction)
  if (view === "month") return addMonths(iso, direction)
  return addDays(iso, direction)
}

type ReservationsPageProps = {
  showHeader?: boolean
  onDateChange?: (date: string) => void
}

export function ReservationsPage({ showHeader = true, onDateChange }: ReservationsPageProps) {
  const { t, i18n } = useTranslation()
  const learnMore = useModuleIntroLink("bookings")
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
  const [loadError, setLoadError] = useState(false)
  const sortedRows = useMemo(() => [...rows].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)), [rows])

  useEffect(() => { onDateChange?.(date) }, [date, onDateChange])

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
  const hasActiveFilters = Boolean(status || date !== tenantTodayIsoDate(timeZoneId) || view !== "day")
  const listDateLabel = view === "day" ? dateLabel : range.from && range.to
    ? `${new Intl.DateTimeFormat(i18n.language).format(new Date(`${range.from}T12:00:00`))} – ${new Intl.DateTimeFormat(i18n.language).format(new Date(`${range.to}T12:00:00`))}`
    : ""

  const today = tenantTodayIsoDate(timeZoneId)
  const navigatorLabel = !date
    ? ""
    : view === "day"
      ? dateLabel
      : view === "month"
        ? new Intl.DateTimeFormat(i18n.language, { month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`))
        : listDateLabel
  // Rows are filtered server-side, so per-status counts are only meaningful while no status is selected.
  const statusCounts = status === "" ? countByStatus(rows) : null

  const filterBar = (
    <FilterBar
      label={t("rentals.reservations.filters")}
      filters={
        <>
          <DateNavigator
            date={date}
            onDateChange={setDate}
            view={view}
            views={[
              { value: "day", label: t("rentals.reservations.viewDay") },
              { value: "week", label: t("rentals.reservations.viewWeek") },
              { value: "month", label: t("rentals.reservations.viewMonth") },
            ]}
            onViewChange={setView}
            step={stepDate}
            today={today}
            label={navigatorLabel}
            labels={{
              previous: t("rentals.reservations.previousDay"),
              next: t("rentals.reservations.nextDay"),
              today: t("rentals.reservations.today"),
              view: t("rentals.reservations.period"),
            }}
          />
          <StatusChips
            label={t("rentals.reservations.status")}
            allLabel={t("rentals.reservations.statusAll")}
            value={status === "" ? null : status}
            onChange={(value) => setStatus(value ?? "")}
            allCount={statusCounts ? rows.length : undefined}
            options={reservationStatuses.map((value) => ({
              value,
              label: t(`rentals.reservations.statuses.${value}`),
              tone: reservationStatusTone[value],
              count: statusCounts?.[value],
            }))}
          />
        </>
      }
    />
  )

  return (
    <div className={cn("reservations-page", showHeader && "reservations-layout")}>
      {showHeader && <ReservationsHeader date={date || undefined} />}
      {isTrialReadOnly && (
        <Alert variant="warning" role="status" className="reservations-trial">
          <AlertTriangle size={20} aria-hidden="true" />
          <AlertDescription>{t("trial.readOnlyHint")}</AlertDescription>
        </Alert>
      )}

      {filterBar}

      <div aria-busy={loading} className="reservations-results">
        {loadError && !loading && sortedRows.length > 0 && (
          <Alert variant="destructive" role="alert" className="reservations-error">
            <AlertTriangle size={20} aria-hidden="true" />
            <AlertDescription>{t("rentals.reservations.loadError")}</AlertDescription>
          </Alert>
        )}
        <ReservationsList
          rows={sortedRows}
          dateLabel={listDateLabel}
          showDates={view !== "day" || !date}
          actions={rowActions}
          loadingLabel={t("rentals.reservations.loading")}
          {...(loading
            ? { state: "loading" as const }
            : loadError && sortedRows.length === 0
              ? { state: "error" as const, error: t("rentals.reservations.loadError"), onRetry: () => { void load() } }
              : {})}
          empty={{
            icon: CalendarRange,
            title: t("rentals.reservations.empty"),
            description: t(hasActiveFilters ? "emptyStates.filterDescription" : "rentals.reservations.emptyDescription"),
            example: hasActiveFilters ? undefined : t("emptyStates.examples.bookings"),
            learnMore: hasActiveFilters ? undefined : learnMore,
            action: hasActiveFilters ? (
              <Button onClick={() => { setDate(tenantTodayIsoDate(timeZoneId)); setStatus(""); setView("day") }}>{t("emptyStates.clearFilters")}</Button>
            ) : (
              <Button className="min-h-11" onClick={() => setView("week")}>{t("rentals.reservations.showWeek")}</Button>
            ),
          }}
        />
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
