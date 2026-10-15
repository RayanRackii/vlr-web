import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useOutletContext, useParams } from "react-router-dom"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  formatMoney,
  formatReservationRange,
} from "@/features/rentals/services/reservationsService"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import { canCustomerSelfCancel } from "@/features/tenantPortal/lib/canCustomerSelfCancel"
import { isPastReservation } from "@/features/tenantPortal/lib/isPastReservation"
import {
  bookPortalSlot,
  cancelMyPortalReservation,
  checkPortalAvailability,
  createPortalReservation,
  fetchPortalRentalAssets,
  fetchPublicScheduleDay,
  formatScheduleTime,
  getCustomerAccessToken,
  getReservationQueueErrorCode,
  isLocationQueueEnabled,
  listMyPortalReservations,
  tenantPortalPath,
  type PortalRentalAsset,
  type PortalReservation,
  type PortalScheduleSlot,
} from "@/features/tenantPortal/services/tenantPortalService"
import {
  brazilTodayIsoDate,
  clampBrazilDateToToday,
  isBrazilSlotStartInPast,
} from "@/lib/brazilTimeZone"

function upcomingBookableSlots(
  daySlots: readonly PortalScheduleSlot[],
  dayDate: string,
) {
  const bookable = daySlots.filter(isCustomerBookableSlot)
  const upcoming = bookable.filter(
    (slot) => !isBrazilSlotStartInPast(dayDate, slot.startTime),
  )
  return {
    upcoming,
    pastHidden: upcoming.length < bookable.length,
  }
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
  const [date, setDate] = useState(brazilTodayIsoDate())
  const [pastSlotsHidden, setPastSlotsHidden] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [selectedRentalAssetId, setSelectedRentalAssetId] = useState<
    string | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const submittingRef = useRef(false)
  const cancelingRef = useRef(false)
  const viewedDateRef = useRef(date)
  const refreshGeneration = useRef(0)
  const [quote, setQuote] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; amount: number | null }
    | { status: "error" }
  >({ status: "idle" })
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
    viewedDateRef.current = date
    if (!signedIn || !date) {
      setSlots([])
      setStartTime("")
      setPastSlotsHidden(false)
      setSlotsLoading(false)
      setSlotsError(false)
      return
    }

    let cancelled = false
    setSlotsLoading(true)
    setSlotsError(false)
    setPastSlotsHidden(false)
    setSlots([])
    setStartTime("")
    setSelectedRentalAssetId(null)
    void fetchPublicScheduleDay(subdomain, date)
      .then((day) => {
        if (cancelled) {
          return
        }
        const selected = upcomingBookableSlots(day.slots, date)
        setSlots(selected.upcoming)
        setPastSlotsHidden(selected.pastHidden)
        const times = listDistinctStartTimes(selected.upcoming)
        setStartTime(times[0]?.startTime ?? "")
      })
      .catch((error) => {
        if (!cancelled) {
          setSlots([])
          setStartTime("")
          setSlotsError(true)
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
  const timeItems = useMemo(
    () =>
      timeWindows.map((window) => ({
        value: window.startTime,
        label: `${formatScheduleTime(window.startTime)} – ${formatScheduleTime(window.endTime)}`,
      })),
    [timeWindows],
  )
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
  const quoteAssetId = selectedAsset?.assetId ?? null
  const quoteStart = selectedSlot?.startTime.slice(0, 5) ?? null
  const quoteEnd = selectedSlot?.endTime.slice(0, 5) ?? null

  useEffect(() => {
    if (!quoteAssetId || !quoteStart || !quoteEnd) {
      setQuote({ status: "idle" })
      return
    }

    let cancelled = false
    setQuote({ status: "loading" })
    void checkPortalAvailability(subdomain, {
      assetId: quoteAssetId,
      date,
      startTime: quoteStart,
      endTime: quoteEnd,
      quantity: 1,
    })
      .then((result) => {
        if (cancelled) {
          return
        }
        setQuote({
          status: "ready",
          amount: result.isAvailable ? result.estimatedTotalAmount : null,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setQuote({ status: "error" })
        }
      })

    return () => {
      cancelled = true
    }
  }, [date, quoteAssetId, quoteEnd, quoteStart, subdomain])

  const queueEnabled = isLocationQueueEnabled(selectedAsset)
  const queue = useReservationQueue({
    rentalAssetId: selectedRentalAssetId,
    enabled: queueEnabled,
  })

  if (!signedIn) {
    return <Navigate to={tenantPortalPath(subdomain)} replace />
  }

  if (menuItemId && !menuItem) {
    return <Navigate to={tenantPortalPath(subdomain, "app")} replace />
  }

  const title = menuItem?.label ?? t("tenantPortal.agenda.title")

  function refreshAgenda(dayDate: string) {
    const generation = refreshGeneration.current + 1
    refreshGeneration.current = generation
    void Promise.all([
      listMyPortalReservations(),
      fetchPublicScheduleDay(subdomain, dayDate),
    ])
      .then(([reservations, day]) => {
        if (refreshGeneration.current !== generation) {
          return
        }
        setMine((current) => {
          const serverIds = new Set(reservations.map((row) => row.id))
          const onlyLocal = current.filter((row) => !serverIds.has(row.id))
          return [...onlyLocal, ...reservations]
        })
        if (viewedDateRef.current !== dayDate) {
          return
        }
        const selected = upcomingBookableSlots(day.slots, dayDate)
        setSlots(selected.upcoming)
        setPastSlotsHidden(selected.pastHidden)
      })
      .catch(() => {
        // The mutation result is already on screen. A slow or failed
        // refresh must not replace the result toast or keep the button busy.
      })
  }

  async function onReserve() {
    if (!selectedAsset || !selectedSlot || submittingRef.current) {
      return
    }
    const asset = selectedAsset
    const slot = selectedSlot
    const dayDate = date
    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = canBookViaSlotId(slot)
        ? await bookPortalSlot({
            slotId: slot.id,
            unitId: asset.unitId,
            quantity: 1,
          })
        : await createPortalReservation({
            unitId: asset.unitId,
            date: dayDate,
            startTime: slot.startTime.slice(0, 5),
            endTime: slot.endTime.slice(0, 5),
            items: [{ assetId: asset.assetId, quantity: 1 }],
          })
      toast.success(
        t("tenantPortal.agenda.reserveSuccessWithTotal", {
          amount: formatMoney(created.totalAmount),
          status: t(`rentals.reservations.statuses.${created.status}`, {
            defaultValue: created.status,
          }),
        }),
      )
      setMine((current) => [
        created,
        ...current.filter((reservation) => reservation.id !== created.id),
      ])
      setSlots((current) =>
        current.filter(
          (candidate) =>
            !(
              candidate.rentalAssetId === slot.rentalAssetId &&
              candidate.startTime === slot.startTime &&
              candidate.endTime === slot.endTime
            ),
        ),
      )
      setSelectedRentalAssetId(null)
      refreshAgenda(dayDate)
    } catch (error) {
      if (queue.applyBookingError(error)) {
        const code = getReservationQueueErrorCode(error)
        toast.error(
          code
            ? t(`tenantPortal.agenda.queue.errors.${code}`)
            : t("tenantPortal.agenda.reserveError"),
        )
        return
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t("tenantPortal.agenda.reserveError"),
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  function requestCancel(id: string) {
    if (cancelingRef.current) {
      return
    }
    setPendingCancelId(id)
  }

  async function confirmCancel() {
    if (pendingCancelId === null || cancelingRef.current) {
      return
    }
    const id = pendingCancelId
    const dayDate = date
    cancelingRef.current = true
    setCancelingId(id)
    try {
      const canceled = await cancelMyPortalReservation(id)
      toast.success(t("tenantPortal.agenda.cancelSuccess"))
      setMine((current) => {
        const exists = current.some(
          (reservation) => reservation.id === canceled.id,
        )
        if (!exists) {
          return [canceled, ...current]
        }
        return current.map((reservation) =>
          reservation.id === canceled.id ? canceled : reservation,
        )
      })
      setPendingCancelId(null)
      refreshAgenda(dayDate)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.cancelReservation"),
      )
      void listMyPortalReservations()
        .then((reservations) => {
          setMine(reservations)
        })
        .catch(() => {
          // Stay on the current list if refetch fails.
        })
    } finally {
      cancelingRef.current = false
      setCancelingId(null)
    }
  }

  function onDateChange(value: string) {
    const next = clampBrazilDateToToday(value)
    viewedDateRef.current = next
    setDate(next)
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
                min={brazilTodayIsoDate()}
                value={date}
                onChange={(event) => {
                  const next = clampBrazilDateToToday(event.target.value)
                  if (event.target.value !== next) {
                    event.currentTarget.value = next
                  }
                  onDateChange(next)
                }}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("tenantPortal.agenda.time")}</span>
              <Select
                modal={false}
                value={startTime || null}
                onValueChange={(value) => {
                  if (!value) {
                    return
                  }
                  setStartTime(value)
                  setSelectedRentalAssetId(null)
                }}
                items={timeItems}
                disabled={
                  slotsLoading || slotsError || timeWindows.length === 0
                }
              >
                <SelectTrigger className="w-full" aria-busy={slotsLoading}>
                  <SelectValue
                    placeholder={
                      slotsLoading
                        ? t("tenantPortal.agenda.loadingTimes")
                        : slotsError
                          ? t("tenantPortal.agenda.slotsError")
                          : t("tenantPortal.agenda.noTimes")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {timeWindows.map((window) => (
                    <SelectItem
                      key={window.startTime}
                      value={window.startTime}
                    >
                      {formatScheduleTime(window.startTime)} –{" "}
                      {formatScheduleTime(window.endTime)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {pastSlotsHidden ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.pastSlotsHidden")}
            </p>
          ) : null}

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

          {queue.view.kind === "closed" ? (
            <p className="rounded-lg border border-border px-3 py-3 text-sm text-muted-foreground">
              {queue.view.waitingRoomTime && queue.view.opensTime
                ? t("tenantPortal.agenda.queue.closed", {
                    waitingRoom: queue.view.waitingRoomTime,
                    opensAt: queue.view.opensTime,
                  })
                : t("tenantPortal.agenda.queue.closedFallback")}
            </p>
          ) : null}

          {queue.view.kind === "join" ? (
            <div className="rounded-lg border border-border px-3 py-3">
              <LoadingButton
                type="button"
                variant="outline"
                loading={queue.joining}
                loadingLabel={t("tenantPortal.agenda.queue.joining")}
                onClick={() => {
                  void queue.join()
                }}
              >
                {t("tenantPortal.agenda.queue.join")}
              </LoadingButton>
            </div>
          ) : null}

          {queue.view.kind === "waiting" ? (
            <div className="space-y-2 rounded-lg border border-border px-3 py-3 text-sm">
              <p className="font-medium">
                {t("tenantPortal.agenda.queue.inQueue")}
              </p>
              <p>
                {t("tenantPortal.agenda.queue.position", {
                  position: queue.view.position,
                })}
              </p>
              <p className="text-muted-foreground">
                {t("tenantPortal.agenda.queue.ahead", {
                  count: queue.view.aheadCount,
                })}
              </p>
              <LoadingButton
                type="button"
                variant="outline"
                loading={queue.leaving}
                loadingLabel={t("tenantPortal.agenda.queue.leaving")}
                onClick={() => {
                  void queue.leave()
                }}
              >
                {t("tenantPortal.agenda.queue.leave")}
              </LoadingButton>
            </div>
          ) : null}

          {queue.view.kind === "active" ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 text-sm">
              <p className="font-medium">
                {t("tenantPortal.agenda.queue.yourTurn")}
              </p>
              <p className="tabular-nums text-muted-foreground">
                {t("tenantPortal.agenda.queue.countdown", {
                  time: queue.view.countdown,
                })}
              </p>
            </div>
          ) : null}

          {queue.view.kind === "expired" ? (
            <div className="space-y-2 rounded-lg border border-border px-3 py-3 text-sm">
              <p className="font-medium">
                {t("tenantPortal.agenda.queue.expired")}
              </p>
              <LoadingButton
                type="button"
                variant="outline"
                loading={queue.joining}
                loadingLabel={t("tenantPortal.agenda.queue.joining")}
                onClick={() => {
                  void queue.join()
                }}
              >
                {t("tenantPortal.agenda.queue.rejoin")}
              </LoadingButton>
            </div>
          ) : null}

          {selectedAsset?.requiresDeposit ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.depositRequired")}
            </p>
          ) : null}

          {quote.status === "loading" ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.quoteLoading")}
            </p>
          ) : null}

          {quote.status === "ready" && quote.amount !== null ? (
            <p className="text-sm font-medium">
              {t("tenantPortal.agenda.available", {
                amount: formatMoney(quote.amount),
              })}
            </p>
          ) : null}

          {quote.status === "ready" && quote.amount === null ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.unavailable")}
            </p>
          ) : null}

          {quote.status === "error" ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.availabilityError")}
            </p>
          ) : null}

          {queue.hideReserveUi ? null : (
          <LoadingButton
            type="button"
            className="w-full sm:w-auto"
            style={{ backgroundColor: primary }}
            loading={submitting}
            loadingLabel={t("tenantPortal.agenda.reserving")}
            disabled={!selectedSlot || !queue.canReserve}
            onClick={() => {
              void onReserve()
            }}
          >
            {t("tenantPortal.agenda.reserveSlot")}
          </LoadingButton>
          )}

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
                      {formatReservationRange(
                        reservation.startDateTime,
                        reservation.endDateTime,
                      )}{" "}
                      ·{" "}
                      {t(`rentals.reservations.statuses.${reservation.status}`, {
                        defaultValue: reservation.status,
                      })}
                      {" · "}
                      {t("tenantPortal.agenda.total", {
                        amount: formatMoney(reservation.totalAmount),
                      })}
                    </p>
                    {isPastReservation(reservation.endDateTime) ? (
                      <p className="text-xs font-medium">
                        {t("tenantPortal.agenda.pastReservation")}
                      </p>
                    ) : null}
                    {!isPastReservation(reservation.endDateTime) &&
                    canCustomerSelfCancel(
                      reservation.status,
                      reservation.startDateTime,
                    ) ? (
                      <LoadingButton
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        loading={cancelingId === reservation.id}
                        loadingLabel={t("tenantPortal.agenda.cancelling")}
                        onClick={() => {
                          requestCancel(reservation.id)
                        }}
                      >
                        {t("tenantPortal.agenda.cancel")}
                      </LoadingButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <AlertDialog
            open={pendingCancelId !== null}
            onOpenChange={(open) => {
              if (!open && !cancelingRef.current) {
                setPendingCancelId(null)
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("tenantPortal.agenda.cancelConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("tenantPortal.agenda.cancelConfirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={cancelingId !== null}>
                  {t("tenantPortal.agenda.cancelConfirmDismiss")}
                </AlertDialogCancel>
                <LoadingButton
                  type="button"
                  variant="destructive"
                  loading={cancelingId !== null}
                  loadingLabel={t("tenantPortal.agenda.cancelling")}
                  onClick={() => {
                    void confirmCancel()
                  }}
                >
                  {t("tenantPortal.agenda.cancelConfirmAction")}
                </LoadingButton>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
