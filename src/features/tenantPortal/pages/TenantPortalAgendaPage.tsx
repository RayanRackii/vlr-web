import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useOutletContext, useParams } from "react-router-dom"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import {
  autoPlaceItems,
  canBookViaSlotId,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH_PERCENT,
  findSlotAtStart,
  isCustomerBookableSlot,
  listDistinctStartTimes,
  pickCustomerLayout,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import { fetchPublicRentalLayouts } from "@/features/rentals/services/rentalLayoutService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import {
  bookPortalSlot,
  createPortalReservation,
  fetchPortalRentalAssets,
  fetchPublicScheduleDay,
  formatScheduleTime,
  getCustomerAccessToken,
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
  const [slots, setSlots] = useState<PortalScheduleSlot[]>([])
  const [date, setDate] = useState(todayIsoDate())
  const [startTime, setStartTime] = useState("")
  const [selectedRentalAssetId, setSelectedRentalAssetId] = useState<
    string | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [layoutItems, setLayoutItems] = useState<
    {
      rentalAssetId: string
      xPercent: number
      yPercent: number
      widthPercent: number
      heightPercent: number
      zIndex: number
    }[]
  >([])
  const [hasAuthoredLayout, setHasAuthoredLayout] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO)
  const [canvasWidthPercent, setCanvasWidthPercent] = useState(
    DEFAULT_CANVAS_WIDTH_PERCENT,
  )

  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (lockedRentalAssetId) {
        return asset.id === lockedRentalAssetId
      }
      if (lockedAssetId) {
        return asset.assetId === lockedAssetId
      }
      return true
    })
  }, [assets, lockedAssetId, lockedRentalAssetId])

  useEffect(() => {
    if (!signedIn) {
      return
    }

    let cancelled = false
    setLoading(true)
    void Promise.all([
      fetchPortalRentalAssets(subdomain),
      listMyPortalReservations(),
      fetchPublicRentalLayouts(subdomain),
    ])
      .then(([assetList, reservations, layouts]) => {
        if (cancelled) {
          return
        }
        setAssets(assetList)
        setMine(reservations)

        const visibleIds = new Set(
          assetList
            .filter((asset) => {
              if (lockedRentalAssetId) {
                return asset.id === lockedRentalAssetId
              }
              if (lockedAssetId) {
                return asset.assetId === lockedAssetId
              }
              return true
            })
            .map((asset) => asset.id),
        )
        const layout = pickCustomerLayout(layouts, visibleIds)
        if (layout) {
          setHasAuthoredLayout(true)
          setAspectRatio(layout.aspectRatio)
          setCanvasWidthPercent(layout.widthPercent)
          setLayoutItems(
            layout.items.map((item) => ({
              rentalAssetId: item.rentalAssetId,
              xPercent: item.xPercent,
              yPercent: item.yPercent,
              widthPercent: item.widthPercent,
              heightPercent: item.heightPercent,
              zIndex: item.zIndex,
            })),
          )
        } else {
          setHasAuthoredLayout(false)
          setAspectRatio(DEFAULT_ASPECT_RATIO)
          setCanvasWidthPercent(DEFAULT_CANVAS_WIDTH_PERCENT)
          setLayoutItems(autoPlaceItems([...visibleIds]))
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

  useEffect(() => {
    if (!signedIn || !date) {
      setSlots([])
      return
    }

    let cancelled = false
    setSlotsLoading(true)
    setSelectedRentalAssetId(null)
    void fetchPublicScheduleDay(subdomain, date)
      .then((day) => {
        if (cancelled) {
          return
        }
        const bookable = day.slots.filter(isCustomerBookableSlot)
        setSlots(bookable)
        const times = listDistinctStartTimes(bookable)
        setStartTime((current) => {
          if (current && times.some((time) => time.startTime === current)) {
            return current
          }
          return times[0]?.startTime ?? ""
        })
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
  }, [signedIn, subdomain, date, t])

  const timeWindows = useMemo(() => listDistinctStartTimes(slots), [slots])
  const placedIds = useMemo(
    () => new Set(layoutItems.map((item) => item.rentalAssetId)),
    [layoutItems],
  )
  const unplacedAssets = visibleAssets.filter(
    (asset) => !placedIds.has(asset.id),
  )

  const selectedSlot = selectedRentalAssetId
    ? findSlotAtStart(slots, selectedRentalAssetId, startTime)
    : undefined
  const selectedAsset = visibleAssets.find(
    (asset) => asset.id === selectedRentalAssetId,
  )

  if (!signedIn) {
    return <Navigate to={tenantPortalPath(subdomain)} replace />
  }

  if (menuItemId && !menuItem) {
    return <Navigate to={tenantPortalPath(subdomain, "app")} replace />
  }

  const title = menuItem?.label ?? t("tenantPortal.agenda.title")

  async function onReserve() {
    if (!selectedAsset || !selectedSlot) {
      return
    }
    setSubmitting(true)
    try {
      if (canBookViaSlotId(selectedSlot)) {
        await bookPortalSlot({
          slotId: selectedSlot.id,
          unitId: selectedAsset.unitId,
          quantity: 1,
        })
      } else {
        await createPortalReservation({
          unitId: selectedAsset.unitId,
          date,
          startTime: selectedSlot.startTime.slice(0, 5),
          endTime: selectedSlot.endTime.slice(0, 5),
          items: [{ assetId: selectedAsset.assetId, quantity: 1 }],
        })
      }
      toast.success(t("tenantPortal.agenda.reserveSuccess"))
      const [reservations, day] = await Promise.all([
        listMyPortalReservations(),
        fetchPublicScheduleDay(subdomain, date),
      ])
      setMine(reservations)
      const bookable = day.slots.filter(isCustomerBookableSlot)
      setSlots(bookable)
      setSelectedRentalAssetId(null)
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

  function spaceState(rentalAssetId: string) {
    const slot = startTime
      ? findSlotAtStart(slots, rentalAssetId, startTime)
      : undefined
    return {
      available: Boolean(slot),
      disabled: !slot,
      selected: selectedRentalAssetId === rentalAssetId,
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {t("tenantPortal.agenda.subtitlePicker")}
        </p>
      </div>

      {loading ? (
        <FormSkeleton fields={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
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
              <span>{t("tenantPortal.agenda.time")}</span>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={startTime}
                disabled={slotsLoading || timeWindows.length === 0}
                onChange={(event) => {
                  setStartTime(event.target.value)
                  setSelectedRentalAssetId(null)
                }}
              >
                {timeWindows.length === 0 ? (
                  <option value="">
                    {t("tenantPortal.agenda.noTimes")}
                  </option>
                ) : (
                  timeWindows.map((window) => (
                    <option key={window.startTime} value={window.startTime}>
                      {formatScheduleTime(window.startTime)} –{" "}
                      {formatScheduleTime(window.endTime)}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          {slotsLoading ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              {t("common.refreshing")}
            </span>
          ) : null}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-emerald-500/70 bg-emerald-100 dark:bg-emerald-950" />
              {t("tenantPortal.agenda.legendAvailable")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-border bg-muted" />
              {t("tenantPortal.agenda.legendUnavailable")}
            </span>
          </div>

          {visibleAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.noAssets")}
            </p>
          ) : (
            <LayoutCanvasBoard
              mode="pick"
              aspectRatio={aspectRatio}
              canvasWidthPercent={canvasWidthPercent}
              items={layoutItems.map((item) => {
                const asset = assets.find(
                  (candidate) => candidate.id === item.rentalAssetId,
                )
                const inVisibleSet = visibleAssets.some(
                  (candidate) => candidate.id === item.rentalAssetId,
                )
                const state = spaceState(item.rentalAssetId)
                const disabled = !inVisibleSet || state.disabled
                return {
                  key: item.rentalAssetId,
                  rentalAssetId: item.rentalAssetId,
                  label: asset?.name ?? item.rentalAssetId,
                  xPercent: item.xPercent,
                  yPercent: item.yPercent,
                  widthPercent: item.widthPercent,
                  heightPercent: item.heightPercent,
                  zIndex: item.zIndex,
                  available: inVisibleSet && state.available,
                  disabled,
                  selected: inVisibleSet && state.selected,
                }
              })}
              onSelect={setSelectedRentalAssetId}
            />
          )}

          {hasAuthoredLayout && unplacedAssets.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t("tenantPortal.agenda.unplaced")}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {unplacedAssets.map((asset) => {
                  const state = spaceState(asset.id)
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      disabled={state.disabled || submitting}
                      aria-pressed={state.selected}
                      className="rounded-lg border px-3 py-4 text-sm font-medium disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                      style={
                        state.disabled
                          ? undefined
                          : {
                              borderColor: state.selected ? primary : undefined,
                              backgroundColor: state.selected
                                ? `${primary}22`
                                : undefined,
                            }
                      }
                      onClick={() => {
                        setSelectedRentalAssetId(asset.id)
                      }}
                    >
                      {asset.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <LoadingButton
            type="button"
            className="w-full sm:w-auto"
            style={{ backgroundColor: primary }}
            loading={submitting}
            loadingLabel={t("tenantPortal.agenda.reserving")}
            disabled={!selectedSlot}
            onClick={() => {
              void onReserve()
            }}
          >
            {t("tenantPortal.agenda.reserveSlot")}
          </LoadingButton>

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
                      {t(`rentals.reservations.statuses.${reservation.status}`, {
                        defaultValue: reservation.status,
                      })}
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
