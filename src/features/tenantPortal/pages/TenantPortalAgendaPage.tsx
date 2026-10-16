import { Loader2 } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Navigate, useLocation, useOutletContext, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import { LocaleDateInput } from "@/components/LocaleDateInput"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  compareResourceNames,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_CANVAS_WIDTH_PERCENT,
  findSlotAtStart,
  isCustomerBookableSlot,
  listDistinctStartTimes,
  orderByResourceName,
  pickCustomerLayout,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import {
  portalPickAvailableClass,
  portalPickAvailableSelectedClass,
  portalPickUnavailableClass,
} from "@/features/rentals/components/layout/portalPickStyles"
import { fetchPublicBookingPolicy } from "@/features/rentals/services/bookingPolicyService"
import { fetchPublicRentalLayouts } from "@/features/rentals/services/rentalLayoutService"
import {
  formatMoney,
  formatReservationRange,
} from "@/features/rentals/services/reservationsService"
import {
  CUSTOMER_MY_RESERVATIONS_HASH,
  localizedCustomerMenuLabel,
} from "@/features/catalog/customerNav"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { SlotHeldByYouNotice } from "@/features/tenantPortal/components/SlotHeldByYouNotice"
import { useRefreshOnForeground } from "@/features/tenantPortal/hooks/useRefreshOnForeground"
import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import {
  agendaRefreshDates,
  agendaReservedSlotKey,
  findVisibleAgendaReservation,
  parseAgendaReservationQuery,
  reservedSlotKeysForDate,
  withoutBookableReservedKeys,
} from "@/features/tenantPortal/lib/agendaReservationQuery"
import {
  commitPortalBooking,
  customerAlreadyHoldsSlot,
  forgetOwnBooking,
  getAgendaQueryRevision,
  invalidateAgendaQueries,
  subscribeAgendaQueries,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import { canCustomerSelfCancel } from "@/features/tenantPortal/lib/canCustomerSelfCancel"
import {
  isDailyBookingLimitError,
  isSlotTakenConflict,
  isSlotUnavailableConflict,
  readDailyBookingLimit,
} from "@/features/tenantPortal/lib/portalBookingError"
import { isPastReservation } from "@/features/tenantPortal/lib/isPastReservation"
import {
  bookPortalSlot,
  cancelMyPortalReservation,
  checkPortalAvailability,
  createPortalReservation,
  fetchPortalRentalAssets,
  fetchPublicScheduleDay,
  formatScheduleTime,
  getReservationQueueErrorCode,
  isCustomerSignedInForTenant,
  isLocationQueueEnabled,
  listMyPortalReservations,
  tenantPortalPath,
  type PortalRentalAsset,
  type PortalReservation,
  type PortalScheduleSlot,
} from "@/features/tenantPortal/services/tenantPortalService"
import { withoutPastTenantSlots } from "@/features/rentals/lib/offerableSlot"
import {
  brazilTodayIsoDate,
  clampBrazilDateToToday,
} from "@/lib/brazilTimeZone"
import appI18n from "@/lib/i18n"
import { cn } from "@/lib/utils"

function isCancelledReservationStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === "cancelled" || normalized === "canceled"
}

function dropScheduleSlot(
  current: readonly PortalScheduleSlot[],
  slot: PortalScheduleSlot,
): PortalScheduleSlot[] {
  return current.filter(
    (candidate) =>
      !(
        candidate.rentalAssetId === slot.rentalAssetId &&
        candidate.startTime === slot.startTime &&
        candidate.endTime === slot.endTime
      ),
  )
}

function partitionAgendaSlots(
  daySlots: readonly PortalScheduleSlot[],
  dayDate: string,
) {
  const observed = withoutPastTenantSlots(dayDate, daySlots)
  const bookableIncludingPast = daySlots.filter(isCustomerBookableSlot)
  const bookable = withoutPastTenantSlots(dayDate, bookableIncludingPast)
  return {
    observed,
    bookable,
    pastHidden: bookable.length < bookableIncludingPast.length,
  }
}

export function TenantPortalAgendaPage() {
  const { t, i18n } = useTranslation()
  const dateInputId = useId()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { menuItemId } = useParams<{ menuItemId?: string }>()
  const { subdomain, primary, menu } =
    useOutletContext<CustomerAppOutletContext>()
  const signedIn = isCustomerSignedInForTenant(subdomain)

  const menuItem = useMemo(
    () => menu.find((item) => item.id === menuItemId) ?? null,
    [menu, menuItemId],
  )

  const lockedAssetId = menuItem?.assetId ?? null
  const lockedRentalAssetId = menuItem?.rentalAssetId ?? null

  const [assets, setAssets] = useState<PortalRentalAsset[]>([])
  const [mine, setMine] = useState<PortalReservation[]>([])
  const [slots, setSlots] = useState<PortalScheduleSlot[]>([])
  const [observedSlots, setObservedSlots] = useState<PortalScheduleSlot[]>([])
  const [optimisticReservedKeys, setOptimisticReservedKeys] = useState<
    ReadonlySet<string>
  >(() => new Set())
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
  const [cancellationPolicyText, setCancellationPolicyText] = useState<
    string | null
  >(null)
  const submittingRef = useRef(false)
  const joinAndReserveLock = useRef(false)
  const cancelingRef = useRef(false)
  const viewedDateRef = useRef(date)
  const scheduleRequest = useRef(0)
  const focusedRowRef = useRef<HTMLLIElement | null>(null)
  const scrolledReservationIdRef = useRef<string | null>(null)
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
    const seenRevision = getAgendaQueryRevision()
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
        if (getAgendaQueryRevision() === seenRevision) {
          setMine(reservations)
        }

        const visibleAssetsForLayout = [...assetList]
          .filter((asset) => {
            if (lockedRentalAssetId) {
              return asset.id === lockedRentalAssetId
            }
            if (lockedAssetId) {
              return asset.assetId === lockedAssetId
            }
            return true
          })
          .sort((left, right) => compareResourceNames(left.name, right.name))
        const visibleIds = new Set(
          visibleAssetsForLayout.map((asset) => asset.id),
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
          setLayoutItems(
            autoPlaceItems(visibleAssetsForLayout.map((asset) => asset.id)),
          )
        }
      })
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : appI18n.t("tenantPortal.agenda.loadError"),
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
  }, [signedIn, subdomain, lockedAssetId, lockedRentalAssetId])

  useEffect(() => {
    if (!signedIn) {
      return
    }

    let cancelled = false
    void fetchPublicBookingPolicy(subdomain)
      .then((policy) => {
        if (!cancelled) {
          setCancellationPolicyText(policy.cancellationPolicyText)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCancellationPolicyText(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [signedIn, subdomain])

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

    const seenRevision = getAgendaQueryRevision()
    const requestId = scheduleRequest.current + 1
    scheduleRequest.current = requestId
    let cancelled = false
    setSlotsLoading(true)
    setSlotsError(false)
    setPastSlotsHidden(false)
    setSlots([])
    setObservedSlots([])
    setStartTime("")
    setSelectedRentalAssetId(null)
    void fetchPublicScheduleDay(subdomain, date)
      .then((day) => {
        if (
          cancelled ||
          scheduleRequest.current !== requestId ||
          getAgendaQueryRevision() !== seenRevision
        ) {
          return
        }
        const selected = partitionAgendaSlots(day.slots, date)
        setSlots(selected.bookable)
        setObservedSlots(selected.observed)
        setPastSlotsHidden(selected.pastHidden)
        setOptimisticReservedKeys((current) =>
          withoutBookableReservedKeys(current, date, selected.bookable),
        )
        const times = listDistinctStartTimes(selected.bookable)
        setStartTime(times[0]?.startTime ?? "")
      })
      .catch((error) => {
        if (
          !cancelled &&
          scheduleRequest.current === requestId &&
          getAgendaQueryRevision() === seenRevision
        ) {
          setSlots([])
          setObservedSlots([])
          setStartTime("")
          setSlotsError(true)
          toast.error(
            error instanceof Error
              ? error.message
              : appI18n.t("tenantPortal.agenda.slotsError"),
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
  }, [signedIn, subdomain, date])

  useEffect(() => {
    return subscribeAgendaQueries((snapshot) => {
      if (
        snapshot.subdomain.trim().toLowerCase() !==
        subdomain.trim().toLowerCase()
      ) {
        return
      }

      setMine((current) => {
        const serverIds = new Set(snapshot.reservations.map((row) => row.id))
        const onlyLocal = current.filter((row) => !serverIds.has(row.id))
        return [...onlyLocal, ...snapshot.reservations]
      })
      if (!snapshot.applySlots) {
        return
      }

      const viewed = viewedDateRef.current
      const match = snapshot.days.find((entry) => entry.dayDate === viewed)
      if (!match) {
        return
      }

      scheduleRequest.current += 1
      const selected = partitionAgendaSlots(match.day.slots, viewed)
      setSlotsLoading(false)
      setSlots(selected.bookable)
      setObservedSlots(selected.observed)
      setPastSlotsHidden(selected.pastHidden)
      setSlotsError(false)
      setOptimisticReservedKeys((current) =>
        withoutBookableReservedKeys(current, viewed, selected.bookable),
      )
    })
  }, [subdomain])

  const derivedReservedKeys = useMemo(
    () => reservedSlotKeysForDate(date, mine, observedSlots),
    [date, mine, observedSlots],
  )
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
  const unplacedAssets = orderByResourceName(
    visibleAssets.filter((asset) => !placedIds.has(asset.id)),
    (asset) => asset.name,
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

  useRefreshOnForeground(() => {
    const day = viewedDateRef.current
    if (day.length === 0) {
      return
    }
    void invalidateAgendaQueries(
      { subdomain, dates: [day] },
      { applySlots: true },
    )
  }, signedIn)

  const focusedReservationId =
    findVisibleAgendaReservation(
      mine,
      parseAgendaReservationQuery(searchParams.get("reservation")),
    )?.id ?? null

  useEffect(() => {
    if (loading || focusedReservationId === null) {
      return
    }

    if (scrolledReservationIdRef.current === focusedReservationId) {
      return
    }

    const row = focusedRowRef.current
    if (row === null || typeof row.scrollIntoView !== "function") {
      return
    }

    row.scrollIntoView({ block: "center" })
    scrolledReservationIdRef.current = focusedReservationId
  }, [focusedReservationId, loading])

  useEffect(() => {
    if (loading || location.hash !== CUSTOMER_MY_RESERVATIONS_HASH) {
      return
    }

    const section = document.getElementById("minhas-reservas")
    if (section === null || typeof section.scrollIntoView !== "function") {
      return
    }

    section.scrollIntoView({ block: "start" })
  }, [loading, location.hash])

  if (!signedIn) {
    return <Navigate to={tenantPortalPath(subdomain)} replace />
  }

  if (menuItemId && !menuItem) {
    return <Navigate to={tenantPortalPath(subdomain, "app")} replace />
  }

  const title = menuItem
    ? localizedCustomerMenuLabel(menuItem.moduleName, menuItem.label, t)
    : t("tenantPortal.agenda.title")
  const tenantCancellationNote = visibleCancellationPolicyText(
    cancellationPolicyText,
  )
  const cancellationPolicyNote =
    tenantCancellationNote ?? t("tenantPortal.agenda.cancellationPolicyDefault")

  function refreshAgenda(dayDates: readonly string[]) {
    void invalidateAgendaQueries(
      { subdomain, dates: dayDates },
      { applySlots: true },
    )
  }

  async function onReserve() {
    if (
      !selectedAsset ||
      !selectedSlot ||
      submittingRef.current ||
      quote.status === "loading"
    ) {
      return
    }
    const asset = selectedAsset
    const slot = selectedSlot
    const dayDate = date
    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = await commitPortalBooking(
        () =>
          canBookViaSlotId(slot)
            ? bookPortalSlot({
                slotId: slot.id,
                unitId: asset.unitId,
                quantity: 1,
              })
            : createPortalReservation({
                unitId: asset.unitId,
                date: dayDate,
                startTime: slot.startTime.slice(0, 5),
                endTime: slot.endTime.slice(0, 5),
                items: [{ assetId: asset.assetId, quantity: 1 }],
              }),
        { subdomain, dates: [dayDate] },
      )
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
      if (viewedDateRef.current === dayDate) {
        setSlots((current) => dropScheduleSlot(current, slot))
        setSelectedRentalAssetId(null)
      }
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
      if (isDailyBookingLimitError(error)) {
        const count = readDailyBookingLimit(error)
        toast.error(
          count === null
            ? t("tenantPortal.agenda.dailyLimitReachedUnknown")
            : t("tenantPortal.agenda.dailyLimitReached", { count }),
        )
        return
      }
      if (isSlotTakenConflict(error)) {
        let reservations = mine
        if (
          !customerAlreadyHoldsSlot(
            dayDate,
            slot.rentalAssetId,
            slot.startTime,
            reservations,
          )
        ) {
          try {
            reservations = await listMyPortalReservations()
            setMine(reservations)
          } catch {
            // Keep the list already on screen when Minhas reservas cannot refresh.
          }
        }
        const heldByCustomer = customerAlreadyHoldsSlot(
          dayDate,
          slot.rentalAssetId,
          slot.startTime,
          reservations,
        )
        toast.error(
          heldByCustomer ? (
            <SlotHeldByYouNotice
              href={`${location.pathname}${location.search}${CUSTOMER_MY_RESERVATIONS_HASH}`}
            />
          ) : (
            t("tenantPortal.agenda.slotTaken")
          ),
        )
        if (viewedDateRef.current === dayDate) {
          const reservedKey = agendaReservedSlotKey(
            dayDate,
            slot.rentalAssetId,
            slot.startTime,
          )
          setOptimisticReservedKeys((current) => {
            if (current.has(reservedKey)) {
              return current
            }
            const next = new Set(current)
            next.add(reservedKey)
            return next
          })
          setSelectedRentalAssetId(null)
        }
        return
      }
      if (isSlotUnavailableConflict(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tenantPortal.agenda.slotTaken"),
        )
        if (viewedDateRef.current === dayDate) {
          setSlots((current) => dropScheduleSlot(current, slot))
          setSelectedRentalAssetId(null)
        }
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

  async function onJoinAndReserve() {
    if (!selectedSlot || submittingRef.current || joinAndReserveLock.current) {
      return
    }
    joinAndReserveLock.current = true
    try {
      const next = await queue.join()
      if (next?.phase === "Open" && next.myTicket?.status === "Active") {
        await onReserve()
      }
    } finally {
      joinAndReserveLock.current = false
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
    const viewedDate = date
    const existing = mine.find((reservation) => reservation.id === id) ?? null
    cancelingRef.current = true
    setCancelingId(id)
    try {
      let current = existing
      try {
        const fresh = await listMyPortalReservations()
        setMine(fresh)
        current = fresh.find((reservation) => reservation.id === id) ?? null
      } catch {
        // The cancel request still runs. The API remains the authority.
      }
      if (current !== null && isCancelledReservationStatus(current.status)) {
        toast.message(t("tenantPortal.agenda.alreadyCancelled"))
        setPendingCancelId(null)
        refreshAgenda(agendaRefreshDates(viewedDate, [current]))
        return
      }
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
      forgetOwnBooking(existing ?? canceled)
      refreshAgenda(
        agendaRefreshDates(
          viewedDate,
          existing === null ? [canceled] : [existing, canceled],
        ),
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.cancelReservation"),
      )
      void listMyPortalReservations()
        .then((fresh) => {
          setMine(fresh)
          const row = fresh.find((reservation) => reservation.id === id) ?? null
          if (row !== null && isCancelledReservationStatus(row.status)) {
            setPendingCancelId(null)
            refreshAgenda(agendaRefreshDates(viewedDate, [row]))
          }
        })
        .catch(() => {
          // The error toast already reported the failure.
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
    const reservedKey =
      startTime.length > 0
        ? agendaReservedSlotKey(date, rentalAssetId, startTime)
        : ""
    const reserved =
      reservedKey.length > 0 &&
      (optimisticReservedKeys.has(reservedKey) ||
        derivedReservedKeys.has(reservedKey))
    const available = Boolean(slot) && !reserved
    const detail =
      startTime.length === 0 || available
        ? null
        : t("tenantPortal.agenda.slotTaken")
    return {
      available,
      disabled: !available,
      selected: available && selectedRentalAssetId === rentalAssetId,
      detail,
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
            <div className="space-y-1 text-sm">
              <label htmlFor={dateInputId}>{t("tenantPortal.agenda.date")}</label>
              <LocaleDateInput
                id={dateInputId}
                locale={i18n.language}
                min={brazilTodayIsoDate()}
                value={date}
                onChange={(nextValue) => {
                  onDateChange(clampBrazilDateToToday(nextValue))
                }}
              />
            </div>
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

          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-3 rounded-sm border-2 border-emerald-700 bg-emerald-500 dark:border-emerald-300" />
              {t("tenantPortal.agenda.legendAvailable")}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-3 rounded-sm border-2 border-foreground/80 bg-foreground/40" />
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
                  detail: inVisibleSet ? state.detail : null,
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
                      aria-label={
                        state.detail
                          ? `${asset.name}. ${state.detail}`
                          : asset.name
                      }
                      className={cn(
                        "rounded-lg border px-3 py-4 text-sm font-medium",
                        state.available &&
                          state.selected &&
                          portalPickAvailableSelectedClass,
                        state.available &&
                          !state.selected &&
                          portalPickAvailableClass,
                        !state.available && portalPickUnavailableClass,
                      )}
                      onClick={() => {
                        setSelectedRentalAssetId(asset.id)
                      }}
                    >
                      <span className="block">{asset.name}</span>
                      {state.detail ? (
                        <span className="mt-1 block text-xs font-semibold">
                          {state.detail}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {queue.explanation ? (
            <p className="text-sm text-muted-foreground">{queue.explanation}</p>
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
                variant={queue.view.joinAndReserve ? "default" : "outline"}
                className={queue.view.joinAndReserve ? "w-full sm:w-auto" : undefined}
                style={
                  queue.view.joinAndReserve
                    ? { backgroundColor: primary }
                    : undefined
                }
                disabled={queue.view.joinAndReserve && !selectedSlot}
                loading={queue.joining}
                loadingLabel={
                  queue.view.joinAndReserve
                    ? t("tenantPortal.agenda.queue.joiningAndReserving")
                    : t("tenantPortal.agenda.queue.joining")
                }
                onClick={() => {
                  if (queue.view.kind === "join" && queue.view.joinAndReserve) {
                    void onJoinAndReserve()
                    return
                  }
                  void queue.join()
                }}
              >
                {queue.view.joinAndReserve
                  ? t("tenantPortal.agenda.queue.joinAndReserve")
                  : t("tenantPortal.agenda.queue.join")}
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
              {t("tenantPortal.agenda.slotTaken")}
            </p>
          ) : null}

          {quote.status === "error" ? (
            <p className="text-sm text-muted-foreground">
              {t("tenantPortal.agenda.availabilityError")}
            </p>
          ) : null}

          {queue.hideReserveUi ||
          (queue.view.kind === "join" && queue.view.joinAndReserve) ? null : (
          <LoadingButton
            type="button"
            className="w-full sm:w-auto"
            style={{ backgroundColor: primary }}
            loading={submitting}
            loadingLabel={t("tenantPortal.agenda.reserving")}
            disabled={
              !selectedSlot ||
              (selectedRentalAssetId !== null &&
                !spaceState(selectedRentalAssetId).available) ||
              !queue.canReserve ||
              quote.status === "loading"
            }
            onClick={() => {
              void onReserve()
            }}
          >
            {t("tenantPortal.agenda.reserveSlot")}
          </LoadingButton>
          )}

          <div
            id="minhas-reservas"
            className="scroll-mt-16 space-y-2 border-t border-border pt-4"
          >
            <h3 className="text-sm font-medium">
              {t("tenantPortal.agenda.myReservations")}
            </h3>
            {mine.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("tenantPortal.agenda.empty")}
              </p>
            ) : (
              <ul className="space-y-2">
                {mine.map((reservation) => {
                  const focused = reservation.id === focusedReservationId
                  return (
                    <li
                      key={reservation.id}
                      ref={focused ? focusedRowRef : undefined}
                      aria-current={focused ? "true" : undefined}
                      data-reservation-focused={focused ? "true" : undefined}
                      className={cn(
                        "scroll-mt-16 rounded-md border px-3 py-2 text-sm",
                        focused
                          ? "border-primary bg-primary/10 ring-2 ring-primary"
                          : "border-border",
                      )}
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
                  )
                })}
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
            <AlertDialogContent className="max-h-[min(80vh,40rem)] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("tenantPortal.agenda.cancelConfirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("tenantPortal.agenda.cancelConfirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {cancellationPolicyNote ? (
                <div className="space-y-1">
                  <p className="font-medium">
                    {t("tenantPortal.agenda.cancellationPolicyLabel")}
                  </p>
                  {/* Plain text only. Never parse the tenant policy as HTML. */}
                  <p
                    className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-muted-foreground"
                    data-testid="cancellation-policy-text"
                  >
                    {cancellationPolicyNote}
                  </p>
                </div>
              ) : null}
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

function visibleCancellationPolicyText(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
