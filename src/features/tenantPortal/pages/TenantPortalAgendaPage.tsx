import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, Navigate, useOutletContext } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TenantPortalOutletContext } from "@/features/tenantPortal/components/TenantPortalLayout"
import {
  checkPortalAvailability,
  createPortalReservation,
  fetchPortalRentalAssets,
  getCustomerAccessToken,
  listMyPortalReservations,
  tenantPortalPath,
  type PortalRentalAsset,
  type PortalReservation,
} from "@/features/tenantPortal/services/tenantPortalService"

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function TenantPortalAgendaPage() {
  const { t } = useTranslation()
  const { subdomain, primary } = useOutletContext<TenantPortalOutletContext>()
  const signedIn = getCustomerAccessToken() !== null

  const [assets, setAssets] = useState<PortalRentalAsset[]>([])
  const [mine, setMine] = useState<PortalReservation[]>([])
  const [assetId, setAssetId] = useState("")
  const [date, setDate] = useState(todayIsoDate())
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!signedIn) {
      return
    }

    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetchPortalRentalAssets(subdomain),
      listMyPortalReservations(),
    ])
      .then(([assetList, reservations]) => {
        if (cancelled) {
          return
        }
        setAssets(assetList)
        setMine(reservations)
        if (assetList[0]) {
          setAssetId(assetList[0].assetId)
        }
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tenantPortal.agenda.loadError"),
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [signedIn, subdomain, t])

  if (!signedIn) {
    return <Navigate to={tenantPortalPath(subdomain)} replace />
  }

  const selected = assets.find((asset) => asset.assetId === assetId)

  async function onCheckAvailability() {
    if (!assetId) {
      return
    }
    try {
      const result = await checkPortalAvailability(subdomain, {
        assetId,
        date,
        startTime,
        endTime,
      })
      if (result.isAvailable) {
        setAvailabilityHint(
          t("tenantPortal.agenda.available", {
            amount: result.estimatedTotalAmount ?? 0,
          }),
        )
      } else {
        setAvailabilityHint(
          result.reason ?? t("tenantPortal.agenda.unavailable"),
        )
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.agenda.availabilityError"),
      )
    }
  }

  async function onReserve() {
    if (!selected) {
      return
    }
    setSubmitting(true)
    try {
      await createPortalReservation({
        unitId: selected.unitId,
        date,
        startTime,
        endTime,
        items: [{ assetId: selected.assetId, quantity: 1 }],
      })
      toast.success(t("tenantPortal.agenda.reserveSuccess"))
      const reservations = await listMyPortalReservations()
      setMine(reservations)
      setAvailabilityHint(null)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.agenda.reserveError"),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("tenantPortal.agenda.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.agenda.subtitle")}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span>{t("tenantPortal.agenda.court")}</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={assetId}
                onChange={(event) => {
                  setAssetId(event.target.value)
                  setAvailabilityHint(null)
                }}
              >
                {assets.length === 0 ? (
                  <option value="">{t("tenantPortal.agenda.noAssets")}</option>
                ) : (
                  assets.map((asset) => (
                    <option key={asset.assetId} value={asset.assetId}>
                      {asset.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span>{t("tenantPortal.agenda.date")}</span>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value)
                  }}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("tenantPortal.agenda.start")}</span>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(event) => {
                    setStartTime(event.target.value)
                  }}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span>{t("tenantPortal.agenda.end")}</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(event) => {
                    setEndTime(event.target.value)
                  }}
                />
              </label>
            </div>

            {availabilityHint ? (
              <p className="text-sm text-muted-foreground">{availabilityHint}</p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={!assetId}
                onClick={() => {
                  void onCheckAvailability()
                }}
              >
                {t("tenantPortal.agenda.check")}
              </Button>
              <Button
                type="button"
                className="flex-1"
                style={{ backgroundColor: primary }}
                disabled={!assetId || submitting}
                onClick={() => {
                  void onReserve()
                }}
              >
                {submitting
                  ? t("tenantPortal.agenda.reserving")
                  : t("tenantPortal.agenda.reserve")}
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-medium">
              {t("tenantPortal.agenda.myReservations")}
            </h3>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tenantPortal.agenda.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {mine.map((reservation) => (
                  <li
                    key={reservation.id}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      {reservation.items.map((item) => item.assetName).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(reservation.startDateTime).toLocaleString()} →{" "}
                      {new Date(reservation.endDateTime).toLocaleTimeString()} ·{" "}
                      {reservation.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <p className="text-center text-sm">
        <Link
          to={tenantPortalPath(subdomain, "app")}
          className="underline"
          style={{ color: primary }}
        >
          {t("tenantPortal.agenda.backHome")}
        </Link>
      </p>
    </div>
  )
}
