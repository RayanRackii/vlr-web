import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { useTrialStatus } from "@/features/users/hooks/useTrialStatus"
import {
  cancelAdminReservation,
  confirmAdminReservation,
  formatMoney,
  formatReservationAssets,
  formatReservationRange,
  listAdminReservations,
  reservationStatuses,
  type AdminReservation,
  type ReservationStatus,
} from "@/features/rentals/services/reservationsService"

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function ReservationsPage() {
  const { t } = useTranslation()
  const { isTrialReadOnly } = useTrialStatus()
  const [date, setDate] = useState(todayIsoDate())
  const [status, setStatus] = useState<ReservationStatus | "">("")
  const [rows, setRows] = useState<AdminReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const items = await listAdminReservations({
        from: date || undefined,
        to: date || undefined,
        status,
      })
      setRows(items)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("rentals.reservations.loadError"),
      )
    } finally {
      setLoading(false)
    }
  }, [date, status, t])

  useEffect(() => {
    void load()
  }, [load])

  async function onConfirm(id: string) {
    setBusyId(id)
    try {
      await confirmAdminReservation(id)
      toast.success(t("rentals.reservations.confirmSuccess"))
      await load()
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
      await load()
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("rentals.reservations.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("rentals.reservations.description")}
        </p>
      </div>

      {isTrialReadOnly ? (
        <p className="text-sm text-amber-800 dark:text-amber-200" role="status">
          {t("trial.readOnlyHint")}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>{t("rentals.reservations.date")}</span>
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t("rentals.reservations.status")}</span>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ReservationStatus | "")
            }}
          >
            <option value="">{t("rentals.reservations.statusAll")}</option>
            {reservationStatuses.map((value) => (
              <option key={value} value={value}>
                {t(`rentals.reservations.statuses.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("rentals.reservations.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((row) => {
            const canConfirm = row.status === "PendingDeposit"
            const canCancel =
              row.status === "PendingDeposit" || row.status === "Confirmed"

            return (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{row.customerName}</p>
                  <p className="text-muted-foreground">
                    {formatReservationAssets(row)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatReservationRange(row.startDateTime, row.endDateTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`rentals.reservations.statuses.${row.status}`)}
                    {" · "}
                    {formatMoney(row.totalAmount)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
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
                  {canCancel ? (
                    <LoadingButton
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={busyId === row.id}
                      disabled={isTrialReadOnly}
                      onClick={() => {
                        void onCancel(row.id)
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
    </div>
  )
}
