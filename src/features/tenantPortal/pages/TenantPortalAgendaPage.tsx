import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useOutletContext, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  bookPortalSlot,
  createPortalReservation,
  fetchPortalRentalAssets,
  fetchPublicScheduleDay,
  formatScheduleTime,
  getCustomerAccessToken,
  isBookablePersistedSlot,
  listMyPortalReservations,
  tenantPortalPath,
  type PortalRentalAsset,
  type PortalReservation,
  type PortalScheduleSlot,
} from "@/features/tenantPortal/services/tenantPortalService"

function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function TenantPortalAgendaPage() {
  const { t } = useTranslation()
  const { menuItemId } = useParams<{ menuItemId?: string }>()
  const { subdomain, primary, menu } =
    useOutletContext<CustomerAppOutletContext>()
  const signedIn = getCustomerAccessToken() !== null

  const menuItem = useMemo(
    () => menu.find((item) => item.id === menuItemId) ?? null,
    [menu, menuItemId],
  )

  const lockedAssetId = menuItem?.assetId ?? null
  const lockedRentalAssetId = menuItem?.rentalAssetId ?? null

  const [assets, setAssets] = useState<PortalRentalAsset[]>([])
  const [mine, setMine] = useState<PortalReservation[]>([])
  const [rentalAssetId, setRentalAssetId] = useState("")
  const [date, setDate] = useState(todayIsoDate())
  const [slots, setSlots] = useState<PortalScheduleSlot[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
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

        if (lockedRentalAssetId) {
          setRentalAssetId(lockedRentalAssetId)
        } else if (lockedAssetId) {
          const match = assetList.find(
            (asset) => asset.assetId === lockedAssetId,
          )
          setRentalAssetId(match?.id ?? "")
        } else if (assetList[0]) {
          setRentalAssetId(assetList[0].id)
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
  }, [signedIn, subdomain, t, lockedAssetId, lockedRentalAssetId])

  const selected = assets.find((asset) => asset.id === rentalAssetId)
  const useSlotGrid =
    !selected?.schedulePolicy ||
    selected.schedulePolicy.toLowerCase() === "slotgrid"

  useEffect(() => {
    if (!signedIn || !rentalAssetId || !date || !useSlotGrid) {
      setSlots([])
      setSelectedSlotId(null)
      return
    }

    let cancelled = false
    setSlotsLoading(true)
    setSelectedSlotId(null)
    void fetchPublicScheduleDay(subdomain, date, rentalAssetId)
      .then((day) => {
        if (!cancelled) {
          setSlots(day.slots)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSlots([])
          toast.error(
            error instanceof Error
              ? error.message
              : t("tenantPortal.agenda.slotsError"),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSlotsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [signedIn, subdomain, rentalAssetId, date, useSlotGrid, t])

  if (!signedIn) {
    return <Navigate to={tenantPortalPath(subdomain)} replace />
  }

  if (menuItemId && !menuItem) {
    return <Navigate to={tenantPortalPath(subdomain, "app")} replace />
  }

  const title = menuItem?.label ?? t("tenantPortal.agenda.title")
  const bookableSlots = slots.filter(isBookablePersistedSlot)
  const lockedSelect = Boolean(lockedAssetId || lockedRentalAssetId)

  async function onReserveSlot() {
    if (!selected || !selectedSlotId) {
      return
    }
    setSubmitting(true)
    try {
      await bookPortalSlot({
        slotId: selectedSlotId,
        unitId: selected.unitId,
        quantity: 1,
      })
      toast.success(t("tenantPortal.agenda.reserveSuccess"))
      const [reservations, day] = await Promise.all([
        listMyPortalReservations(),
        fetchPublicScheduleDay(subdomain, date, rentalAssetId),
      ])
      setMine(reservations)
      setSlots(day.slots)
      setSelectedSlotId(null)
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

  async function onReserveManual() {
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
      setMine(await listMyPortalReservations())
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
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {useSlotGrid
            ? t("tenantPortal.agenda.subtitleSlots")
            : t("tenantPortal.agenda.subtitle")}
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
                value={rentalAssetId}
                disabled={lockedSelect}
                onChange={(event) => {
                  setRentalAssetId(event.target.value)
                }}
              >
                {assets.length === 0 ? (
                  <option value="">{t("tenantPortal.agenda.noAssets")}</option>
                ) : (
                  assets
                    .filter((asset) => {
                      if (lockedRentalAssetId) {
                        return asset.id === lockedRentalAssetId
                      }
                      if (lockedAssetId) {
                        return asset.assetId === lockedAssetId
                      }
                      return true
                    })
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))
                )}
              </select>
            </label>

            <label className="block space-y-1 text-sm sm:max-w-xs">
              <span>{t("tenantPortal.agenda.date")}</span>
              <Input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                }}
              />
            </label>

            {useSlotGrid ? (
              <div className="space-y-3">
                {slotsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t("common.loading")}
                  </p>
                ) : bookableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("tenantPortal.agenda.noSlots")}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {bookableSlots.map((slot) => {
                      const active = selectedSlotId === slot.id
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          className="rounded-md border px-3 py-2 text-left text-sm transition-colors"
                          style={{
                            borderColor: active
                              ? primary
                              : slot.occupancyKindColorHex ?? undefined,
                            backgroundColor: active
                              ? `${primary}18`
                              : undefined,
                          }}
                          onClick={() => {
                            setSelectedSlotId(slot.id)
                          }}
                        >
                          <span className="font-medium">
                            {formatScheduleTime(slot.startTime)} –{" "}
                            {formatScheduleTime(slot.endTime)}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {slot.occupancyKindLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  style={{ backgroundColor: primary }}
                  disabled={!selectedSlotId || submitting}
                  onClick={() => {
                    void onReserveSlot()
                  }}
                >
                  {submitting
                    ? t("tenantPortal.agenda.reserving")
                    : t("tenantPortal.agenda.reserveSlot")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
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
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  style={{ backgroundColor: primary }}
                  disabled={!rentalAssetId || submitting}
                  onClick={() => {
                    void onReserveManual()
                  }}
                >
                  {submitting
                    ? t("tenantPortal.agenda.reserving")
                    : t("tenantPortal.agenda.reserve")}
                </Button>
              </div>
            )}
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
                      {reservation.items
                        .map((item) => item.assetName)
                        .join(", ")}
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
    </div>
  )
}
