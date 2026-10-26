import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { LocaleDateInput } from "@/components/LocaleDateInput"
import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"
import { toast } from "sonner"

import { CalendarRange } from "lucide-react"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { PageHeader } from "@/components/layout/PageHeader"
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
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingButton } from "@/components/ui/loading-button"
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

const STATUS_BADGE_VARIANT: Record<
  ReservationStatus,
  "secondary" | "success" | "destructive" | "info"
> = {
  PendingDeposit: "secondary",
  Confirmed: "info",
  Completed: "success",
  Canceled: "destructive",
}

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

export function ReservationsPage() {
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <PageHeader
        icon={CalendarRange}
        title={t("rentals.reservations.title")}
        description={t("rentals.reservations.description")}
      />
      <p className="text-xs text-muted-foreground" data-testid="tenant-tz-label">
        {formatTenantTimeZoneLabel(timeZoneId, i18n.language, date || undefined)}
      </p>

      {isTrialReadOnly ? (
        <Alert variant="warning" role="status">
          <AlertDescription>{t("trial.readOnlyHint")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label={t("rentals.reservations.date")}
            className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
          >
            {(["day", "week", "month"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === value ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
                )}
              >
                {t(`rentals.reservations.view${value[0].toUpperCase()}${value.slice(1)}`)}
              </button>
            ))}
          </div>
          <label className="flex min-w-0 items-center gap-2 text-sm">
            <span className="sr-only">{t("rentals.reservations.date")}</span>
            <LocaleDateInput
              value={date}
              locale={i18n.language}
              today={tenantTodayIsoDate(timeZoneId)}
              className="min-w-0"
              onChange={(value) => {
                setDate(value)
              }}
            />
          </label>
        </div>

        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="sr-only">{t("rentals.reservations.status")}</legend>
          {[
            { value: "" as const, label: t("rentals.reservations.statusAll") },
            ...reservationStatuses.map((value) => ({
              value,
              label: t(`rentals.reservations.statuses.${value}`),
            })),
          ].map((option) => {
            const isActive = status === option.value
            return (
              <button
                key={option.value || "all"}
                type="button"
                aria-pressed={isActive}
                onClick={() => setStatus(option.value)}
                className={cn(
                  "min-h-10 rounded-full border px-3 text-xs font-medium transition-colors motion-safe:transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            )
          })}
        </fieldset>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t("rentals.reservations.empty")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
          {rows.map((row) => {
            const canConfirm = row.status === "PendingDeposit"
            const canComplete =
              row.status === "Confirmed" &&
              can("rentals.reservations.complete")
            const canCancel =
              row.status === "PendingDeposit" || row.status === "Confirmed"

            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-4 py-3.5 text-sm motion-safe:transition-colors hover:bg-muted/40 sm:grid sm:grid-cols-[1.4fr_1.4fr_auto] sm:items-center sm:gap-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.customerName}</p>
                    <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                      {t(`rentals.reservations.statuses.${row.status}`)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {formatReservationAssets(row)}
                  </p>
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-muted-foreground">
                    {formatReservationRange(
                      row.startDateTime,
                      row.endDateTime,
                      timeZoneId,
                    )}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMoney(row.totalAmount)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {canConfirm ? (
                    <LoadingButton
                      type="button"
                      size="sm"
                      loading={busyId === row.id}
                      disabled={isTrialReadOnly}
                      onClick={() => {
                        void onConfirm(row.id)
                      }}
                    >
                      {t("rentals.reservations.confirm")}
                    </LoadingButton>
                  ) : null}
                  {canComplete ? (
                    <LoadingButton
                      type="button"
                      size="sm"
                      loading={busyId === row.id}
                      disabled={isTrialReadOnly}
                      onClick={() => {
                        void onComplete(row.id)
                      }}
                    >
                      {t("rentals.reservations.complete")}
                    </LoadingButton>
                  ) : null}
                  {canCancel ? (
                    <LoadingButton
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={busyId === row.id}
                      disabled={isTrialReadOnly}
                      onClick={() => {
                        setCancelTarget(row)
                      }}
                    >
                      {t("rentals.reservations.cancel")}
                    </LoadingButton>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && busyId === null) setCancelTarget(null)
        }}
      >
        <AlertDialogContent>
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
