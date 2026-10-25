import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { CalendarRange } from "lucide-react"

import { PageContentSkeleton } from "@/components/loading/PageContentSkeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

const ALL_STATUSES = "__all__"

const STATUS_BADGE_VARIANT: Record<
  ReservationStatus,
  "secondary" | "success" | "destructive" | "info"
> = {
  PendingDeposit: "secondary",
  Confirmed: "info",
  Completed: "success",
  Canceled: "destructive",
}

export function ReservationsPage() {
  const { t } = useTranslation()
  const { can } = usePermissions()
  const timeZoneId = useTenantTimeZone()
  const { isTrialReadOnly } = useTrialStatus()
  const [date, setDate] = useState(() => tenantTodayIsoDate(timeZoneId))
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

  async function onComplete(id: string) {
    setBusyId(id)
    try {
      await completeAdminReservation(id)
      toast.success(t("rentals.reservations.completeSuccess"))
      await load()
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
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <PageHeader
        title={t("rentals.reservations.title")}
        description={t("rentals.reservations.description")}
      />

      {isTrialReadOnly ? (
        <Alert variant="warning" role="status">
          <AlertDescription>{t("trial.readOnlyHint")}</AlertDescription>
        </Alert>
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
          <Select
            modal={false}
            value={status || ALL_STATUSES}
            onValueChange={(value) => {
              if (typeof value !== "string") {
                return
              }
              setStatus(
                value === ALL_STATUSES ? "" : (value as ReservationStatus),
              )
            }}
            items={[
              {
                value: ALL_STATUSES,
                label: t("rentals.reservations.statusAll"),
              },
              ...reservationStatuses.map((value) => ({
                value,
                label: t(`rentals.reservations.statuses.${value}`),
              })),
            ]}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={t("rentals.reservations.statusAll")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>
                {t("rentals.reservations.statusAll")}
              </SelectItem>
              {reservationStatuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`rentals.reservations.statuses.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {loading ? (
        <PageContentSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t("rentals.reservations.empty")} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
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
                className="flex flex-col gap-3 px-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
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
                  <p className="text-muted-foreground">
                    {formatReservationRange(
                      row.startDateTime,
                      row.endDateTime,
                      timeZoneId,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
