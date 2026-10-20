import { PortalSessionExpiredError, notifyPortalSessionExpired } from "@/features/tenantPortal/lib/portalSessionError"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Navigate,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { toast } from "sonner"

import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import {
  LocaleDateInput,
  type LocaleDateChangeSource,
} from "@/components/LocaleDateInput"
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
  normalizeClock,
  orderByResourceName,
  pickCustomerLayout,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import {
  portalPickAvailableClass,
  portalPickAvailableSelectedClass,
  portalPickPendingClass,
  portalPickUnavailableClass,
} from "@/features/rentals/components/layout/portalPickStyles"
import {
  horizonEndDate,
  resolveAgendaHorizonDays,
} from "@/features/rentals/lib/bookingHorizon"
import { fetchPublicBookingPolicy } from "@/features/rentals/services/bookingPolicyService"
import { fetchPublicRentalLayouts } from "@/features/rentals/services/rentalLayoutService"
import { formatReservationRange } from "@/features/rentals/services/reservationsService"
import {
  CUSTOMER_MY_RESERVATIONS_HASH,
  localizedCustomerMenuLabel,
} from "@/features/catalog/customerNav"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { SlotHeldByYouNotice } from "@/features/tenantPortal/components/SlotHeldByYouNotice"
import { useRefreshOnForeground } from "@/features/tenantPortal/hooks/useRefreshOnForeground"
import { useBookingIdleTimeout } from "@/features/tenantPortal/hooks/useBookingIdleTimeout"
import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import {
  clearAgendaSelectionNotice,
  showAgendaSelectionNotice,
} from "@/features/tenantPortal/lib/agendaSelectionNotice"
import { bookingIdleRedirectTarget } from "@/features/tenantPortal/lib/bookingIdleSettings"
import {
  agendaRefreshDates,
  agendaReservedSlotKey,
  findVisibleAgendaReservation,
  isBlockingReservationStatus,
  reservationCivilStart,
  parseAgendaReservationQuery,
  reservedSlotKeysForDate,
  withoutBookableReservedKeys,
} from "@/features/tenantPortal/lib/agendaReservationQuery"
import {
  agendaSelectionSearchParams,
  clampTypedDateToHorizon,
  classifyAgendaDateAttempt,
  readAgendaDateParam,
  readAgendaTimeParam,
} from "@/features/tenantPortal/lib/agendaSelectionQuery"
import {
  commitPortalBooking,
  customerAlreadyHoldsSlot,
  forgetOwnBooking,
  forgetRecentReservation,
  getAgendaQueryRevision,
  getAgendaSessionGeneration,
  invalidateAgendaQueries,
  isPortalBookingInFlight,
  mergeServerReservations,
  rememberOwnBooking,
  recentPortalReservations,
  releaseCancelledOwnSlots,
  subscribeAgendaQueries,
} from "@/features/tenantPortal/lib/agendaQueryClient"
import { canCustomerSelfCancel } from "@/features/tenantPortal/lib/canCustomerSelfCancel"
import {
  describeBookingError,
  isBookingHorizonError,
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
import {
  isPastTenantSlotStart,
  withoutPastTenantSlots,
} from "@/features/rentals/lib/offerableSlot"
import { brazilTodayIsoDate } from "@/lib/brazilTimeZone"
import appI18n from "@/lib/i18n"
import { formatLocaleCivilDayMonth, formatLocaleCurrency } from "@/lib/localeFormat"
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
  const moneyLocale = i18n.resolvedLanguage ?? i18n.language
  function formatBookingMoney(amount: number): string {
    return formatLocaleCurrency(amount, "BRL", moneyLocale)
  }
  const dateInputId = useId()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
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
  const [mine, setMine] = useState<PortalReservation[]>(() =>
    recentPortalReservations(subdomain),
  )
  const mineRef = useRef(mine)
  mineRef.current = mine
  const [slots, setSlots] = useState<PortalScheduleSlot[]>([])
  const [observedSlots, setObservedSlots] = useState<PortalScheduleSlot[]>([])
  const [optimisticReservedKeys, setOptimisticReservedKeys] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [date, setDate] = useState(() =>
    readAgendaDateParam(searchParams.get("date"), brazilTodayIsoDate()),
  )
  const [slotsBelongToDate, setSlotsBelongToDate] = useState(date)
  const [pastSlotsHidden, setPastSlotsHidden] = useState(false)
  const [startTime, setStartTime] = useState(
    () => readAgendaTimeParam(searchParams.get("time")) ?? "",
  )
  const preferredTimeRef = useRef(startTime)
  const [selectedRentalAssetId, setSelectedRentalAssetId] = useState<
    string | null
  >(null)
  const selectionRef = useRef(selectedRentalAssetId)
  selectionRef.current = selectedRentalAssetId
  const clearUnavailableSelection = useCallback((force = false) => {
    if (submittingRef.current && !force) return
    if (selectionRef.current === null) return
    selectionRef.current = null
    setSelectedRentalAssetId(null)
    showAgendaSelectionNotice(subdomain, "unavailable")
    toast.message(appI18n.t("tenantPortal.agenda.selectionUnavailable"))
  }, [subdomain])
  const selectRentalAsset = useCallback((rentalAssetId: string) => {
    clearAgendaSelectionNotice(subdomain)
    selectionRef.current = rentalAssetId
    setSelectedRentalAssetId(rentalAssetId)
  }, [subdomain])
  const [loading, setLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null)
  const [cancellationPolicyText, setCancellationPolicyText] = useState<
    string | null
  >(null)
  const [policyHorizonDays, setPolicyHorizonDays] = useState<
    number | null | undefined
  >(undefined)
  const [bookingPolicyReady, setBookingPolicyReady] = useState(false)
  const [horizonAdjusted, setHorizonAdjusted] = useState(false)
  const [dateRejection, setDateRejection] = useState<"before" | "after" | null>(
    null,
  )
  const [seenHash, setSeenHash] = useState(location.hash)
  const [slotReloadNonce, setSlotReloadNonce] = useState(0)
  const horizonHintId = useId()
  const dateFeedbackId = useId()
  const submittingRef = useRef(false)
  const joinAndReserveLock = useRef(false)
  const cancelingRef = useRef(false)
  const viewedDateRef = useRef(date)
  const scheduleRequest = useRef(0)
  const checkIdleTimeoutRef = useRef<() => boolean>(() => false)
  const fetchedSelectionScope = useRef<string | null>(null)
  const lastWrittenSearch = useRef<string | null>(null)
  const pendingSearchWrite = useRef(false)
  const searchWriteBaseline = useRef<string | null>(null)
  const replaceSelectionSearch = useRef(true)
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

  const queueAssetIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    queueAssetIdsRef.current = new Set(
      visibleAssets.filter(isLocationQueueEnabled).map((asset) => asset.id),
    )
  }, [visibleAssets])

  const horizonDays = resolveAgendaHorizonDays(visibleAssets, policyHorizonDays)
  const horizonMaxDate = horizonEndDate(brazilTodayIsoDate(), horizonDays)
  const dayFetchGate =
    horizonMaxDate !== null && date > horizonMaxDate
      ? "hold"
      : !bookingPolicyReady && date > brazilTodayIsoDate()
        ? "wait"
        : "go"

  useEffect(() => {
    if (horizonMaxDate === null || date <= horizonMaxDate) {
      return
    }
    setHorizonAdjusted(true)
    setDateRejection(null)
    viewedDateRef.current = horizonMaxDate
    replaceSelectionSearch.current = true
    setDate(horizonMaxDate)
  }, [date, horizonMaxDate])

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
          setMine(
            mergeServerReservations(
              recentPortalReservations(subdomain),
              reservations,
            ),
          )
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
        if (error instanceof PortalSessionExpiredError) {
          notifyPortalSessionExpired()
          return
        }
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
    setBookingPolicyReady(false)
    void fetchPublicBookingPolicy(subdomain)
      .then((policy) => {
        if (!cancelled) {
          setCancellationPolicyText(policy.cancellationPolicyText)
          setPolicyHorizonDays(
            policy.maxAdvanceBookingDays === undefined
              ? undefined
              : policy.maxAdvanceBookingDays,
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCancellationPolicyText(null)
          setPolicyHorizonDays(undefined)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBookingPolicyReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [signedIn, subdomain])

  useEffect(() => {
    viewedDateRef.current = date
    const scope = JSON.stringify([subdomain, menuItemId, date])
    const contextChanged = fetchedSelectionScope.current !== scope
    fetchedSelectionScope.current = scope
    if (contextChanged) {
      clearUnavailableSelection()
    }
    if (!signedIn || !date) {
      setSlots([])
      setObservedSlots([])
      setSlotsBelongToDate(date)
      preferredTimeRef.current = ""
      setStartTime("")
      setPastSlotsHidden(false)
      setSlotsLoading(false)
      setSlotsError(false)
      clearUnavailableSelection()
      return
    }

    if (dayFetchGate !== "go") {
      setSlotsLoading(true)
      setSlotsError(false)
      setPastSlotsHidden(false)
      setSlots([])
      setObservedSlots([])
      setSlotsBelongToDate(date)
      clearUnavailableSelection()
      return
    }

    const seenRevision = getAgendaQueryRevision()
    const requestId = scheduleRequest.current + 1
    scheduleRequest.current = requestId
    let cancelled = false
    setSlotsLoading(true)
    setSlotsError(false)
    setPastSlotsHidden(false)
    // Keep the current choice and data during a same-day refresh. Controls
    // stay disabled until the new availability has been checked.
    if (contextChanged) {
      setSlots([])
      setObservedSlots([])
    }
    setSlotsBelongToDate(date)
    if (preferredTimeRef.current.length === 0) {
      setStartTime("")
    }
    void fetchPublicScheduleDay(subdomain, date)
      .then((day) => {
        if (
          cancelled ||
          scheduleRequest.current !== requestId ||
          getAgendaQueryRevision() !== seenRevision
        ) {
          return
        }
        if (checkIdleTimeoutRef.current()) return
        const selected = partitionAgendaSlots(day.slots, date)
        setSlots(selected.bookable)
        setObservedSlots(selected.observed)
        setPastSlotsHidden(selected.pastHidden)
        setOptimisticReservedKeys((current) =>
          withoutBookableReservedKeys(current, date, selected.bookable),
        )
        const times = listDistinctStartTimes(selected.bookable)
        const preferred = normalizeClock(preferredTimeRef.current)
        const kept = times.find((window) => window.startTime === preferred)
        const nextTime = kept?.startTime ?? times[0]?.startTime ?? ""
        if (nextTime !== preferred && !submittingRef.current) {
          // The queue belongs to the Location's daily opening, not a slot.
          if (selectionRef.current && queueAssetIdsRef.current.has(selectionRef.current)) {
            showAgendaSelectionNotice(subdomain, "unavailable")
            toast.message(appI18n.t("tenantPortal.agenda.selectionUnavailable"))
          } else {
            clearUnavailableSelection()
          }
        }
        preferredTimeRef.current = nextTime
        setStartTime(nextTime)
      })
      .catch((error) => {
        if (
          !cancelled &&
          scheduleRequest.current === requestId &&
          getAgendaQueryRevision() === seenRevision
        ) {
          setSlotsError(true)
          toast.error(
            describeBookingError(
              error,
              appI18n.t("tenantPortal.agenda.slotsError"),
            ),
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
  }, [clearUnavailableSelection, date, dayFetchGate, menuItemId, signedIn, slotReloadNonce, subdomain])

  useEffect(() => {
    const today = brazilTodayIsoDate()
    const current = searchParams.toString()
    const urlDate = readAgendaDateParam(searchParams.get("date"), today)
    const urlBeyondHorizon =
      horizonMaxDate !== null && urlDate > horizonMaxDate
    function writeSearch(next: URLSearchParams, replace: boolean) {
      const nextQuery = next.toString()
      navigate(
        {
          pathname: location.pathname,
          search: nextQuery.length > 0 ? `?${nextQuery}` : "",
          hash: location.hash,
        },
        { replace },
      )
    }
    if (
      pendingSearchWrite.current &&
      current === lastWrittenSearch.current
    ) {
      pendingSearchWrite.current = false
      searchWriteBaseline.current = null
    } else if (
      pendingSearchWrite.current &&
      current === searchWriteBaseline.current
    ) {
      return
    } else if (
      lastWrittenSearch.current !== null &&
      current !== lastWrittenSearch.current
    ) {
      pendingSearchWrite.current = false
      searchWriteBaseline.current = null
      const urlTime = readAgendaTimeParam(searchParams.get("time")) ?? ""
      // #minhas-reservas is the same page. A link that drops ?time= must
      // not blank the loaded choice, or Horário shows "no times".
      if (urlTime.length === 0 && urlDate === date && startTime.length > 0) {
        const next = agendaSelectionSearchParams(
          searchParams,
          date,
          startTime,
          today,
        )
        const nextQuery = next.toString()
        if (nextQuery !== current) {
          searchWriteBaseline.current = current
          lastWrittenSearch.current = nextQuery
          pendingSearchWrite.current = true
          replaceSelectionSearch.current = true
          writeSearch(next, true)
        }
        return
      }
      lastWrittenSearch.current = current
      replaceSelectionSearch.current = urlBeyondHorizon
      setHorizonAdjusted(urlBeyondHorizon)
      if (urlDate !== date) {
        viewedDateRef.current = urlDate
        setDate(urlDate)
        if (!urlBeyondHorizon) {
          setDateRejection(null)
        }
      }
      if (urlTime !== startTime) {
        preferredTimeRef.current = urlTime
        setStartTime(urlTime)
      }
      return
    }

    const timeForUrl =
      startTime.length > 0 ? startTime : preferredTimeRef.current
    const next = agendaSelectionSearchParams(
      searchParams,
      date,
      timeForUrl,
      today,
    )
    const nextQuery = next.toString()
    if (nextQuery === current) {
      lastWrittenSearch.current = current
      if (startTime.length > 0 && !urlBeyondHorizon) {
        replaceSelectionSearch.current = false
      }
      return
    }

    const replace = replaceSelectionSearch.current || urlBeyondHorizon
    if (startTime.length > 0 && !urlBeyondHorizon) {
      replaceSelectionSearch.current = false
    }
    searchWriteBaseline.current = current
    lastWrittenSearch.current = nextQuery
    pendingSearchWrite.current = true
    writeSearch(next, replace)
  }, [
    date,
    horizonMaxDate,
    location.hash,
    location.pathname,
    navigate,
    searchParams,
    startTime,
  ])

  useEffect(() => {
    return subscribeAgendaQueries((snapshot) => {
      if (
        snapshot.subdomain.trim().toLowerCase() !==
        subdomain.trim().toLowerCase()
      ) {
        return
      }

      setMine((current) =>
        mergeServerReservations(current, snapshot.reservations),
      )
      if (!snapshot.applySlots) {
        return
      }

      const viewed = viewedDateRef.current
      const match = snapshot.days.find((entry) => entry.dayDate === viewed)
      if (!match) {
        return
      }

      if (checkIdleTimeoutRef.current()) return
      scheduleRequest.current += 1
      const selected = partitionAgendaSlots(match.day.slots, viewed)
      setSlotsLoading(false)
      setSlotsBelongToDate(viewed)
      setSlots(selected.bookable)
      setObservedSlots(selected.observed)
      setPastSlotsHidden(selected.pastHidden)
      setSlotsError(false)
      setOptimisticReservedKeys((current) =>
        withoutBookableReservedKeys(current, viewed, selected.bookable),
      )
    })
  }, [subdomain])

  const schedulePending = slotsLoading || slotsBelongToDate !== date
  const slotsForView = useMemo(
    () => (slotsBelongToDate === date ? slots : []),
    [date, slots, slotsBelongToDate],
  )
  const observedForView = useMemo(
    () => (slotsBelongToDate === date ? observedSlots : []),
    [date, observedSlots, slotsBelongToDate],
  )
  const derivedReservedKeys = useMemo(
    () => reservedSlotKeysForDate(date, mine, observedForView),
    [date, mine, observedForView],
  )
  const timeWindows = useMemo(
    () => listDistinctStartTimes(slotsForView),
    [slotsForView],
  )
  const timeItems = useMemo(
    () =>
      timeWindows.map((window) => ({
        value: window.startTime,
        label: `${formatScheduleTime(window.startTime)} – ${formatScheduleTime(window.endTime)}`,
      })),
    [timeWindows],
  )

  useEffect(() => {
    if (schedulePending || slotsError || timeWindows.length === 0) {
      return
    }
    if (timeWindows.some((window) => window.startTime === startTime)) {
      return
    }
    const next = timeWindows[0]?.startTime ?? ""
    if (next.length === 0) {
      return
    }
    if (selectionRef.current && startTime.length > 0 && !submittingRef.current) {
      if (queueAssetIdsRef.current.has(selectionRef.current)) {
        showAgendaSelectionNotice(subdomain, "unavailable")
        toast.message(appI18n.t("tenantPortal.agenda.selectionUnavailable"))
      } else {
        clearUnavailableSelection()
      }
    }
    preferredTimeRef.current = next
    setStartTime(next)
  }, [clearUnavailableSelection, schedulePending, slotsError, startTime, subdomain, timeWindows])

  useEffect(() => {
    if (seenHash === location.hash) {
      return
    }
    if (
      seenHash === CUSTOMER_MY_RESERVATIONS_HASH &&
      location.hash !== CUSTOMER_MY_RESERVATIONS_HASH
    ) {
      setSlotReloadNonce((current) => current + 1)
    }
    setSeenHash(location.hash)
  }, [location.hash, seenHash])
  const placedIds = useMemo(
    () => new Set(layoutItems.map((item) => item.rentalAssetId)),
    [layoutItems],
  )
  const unplacedAssets = orderByResourceName(
    visibleAssets.filter((asset) => !placedIds.has(asset.id)),
    (asset) => asset.name,
  )

  const selectedSlot = selectedRentalAssetId
    ? findSlotAtStart(slotsForView, selectedRentalAssetId, startTime)
    : undefined
  const selectedAsset = visibleAssets.find(
    (asset) => asset.id === selectedRentalAssetId,
  )
  const quoteAssetId = selectedAsset?.assetId ?? null
  const quoteStart = selectedSlot?.startTime.slice(0, 5) ?? null
  const quoteEnd = selectedSlot?.endTime.slice(0, 5) ?? null
  const quoteUnavailable = quote.status === "ready" && quote.amount === null

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
      .catch((error: unknown) => {
        if (!cancelled) {
          setQuote({ status: "error" })
          if (isBookingHorizonError(error)) {
            toast.error(
              describeBookingError(
                error,
                t("tenantPortal.agenda.availabilityError"),
              ),
            )
          }
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

  useEffect(() => {
    if (loading || schedulePending || slotsError || submittingRef.current || !selectedRentalAssetId) return
    const key = agendaReservedSlotKey(date, selectedRentalAssetId, startTime)
    if (
      !selectedAsset || (!queueEnabled && (
        !selectedSlot || !isCustomerBookableSlot(selectedSlot) ||
        optimisticReservedKeys.has(key) || derivedReservedKeys.has(key)
      ))
    ) {
      // Reconcile the user's choice only after asynchronous availability settles.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      clearUnavailableSelection()
    }
  }, [
    clearUnavailableSelection, submitting, date, derivedReservedKeys, loading, optimisticReservedKeys, queueEnabled, schedulePending,
    selectedAsset, selectedRentalAssetId, selectedSlot, slotsError, startTime,
  ])

  useEffect(() => {
    if (!selectedSlot || !selectedRentalAssetId) {
      return
    }

    const checkSelectedSlotStart = () => {
      if (submittingRef.current) {
        return
      }
      if (!isPastTenantSlotStart(date, selectedSlot.startTime)) {
        return
      }
      clearUnavailableSelection()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        checkSelectedSlotStart()
      }
    }

    checkSelectedSlotStart()
    const interval = window.setInterval(checkSelectedSlotStart, 30_000)
    window.addEventListener("focus", checkSelectedSlotStart)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", checkSelectedSlotStart)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [clearUnavailableSelection, date, selectedRentalAssetId, selectedSlot])

  const checkIdleTimeout = useBookingIdleTimeout({
    // Explicit time changes clear the asset. Automatic time fallback must not
    // extend an idle deadline for the Location's daily queue.
    selectionKey: signedIn && selectedRentalAssetId
      ? JSON.stringify([subdomain, menuItemId, date, selectedRentalAssetId])
      : null,
    timeoutMinutes: menuItem?.bookingIdleTimeoutMinutes,
    paused: submitting || queue.joining || queue.leaving || queue.view.kind === "active" ||
      (selectedRentalAssetId !== null && isPortalBookingInFlight(date, selectedRentalAssetId, startTime)),
    onExpire: () => {
      selectionRef.current = null
      setSelectedRentalAssetId(null)
      showAgendaSelectionNotice(subdomain, "expired")
      toast.message(t("tenantPortal.agenda.selectionExpired"))
      navigate(bookingIdleRedirectTarget(subdomain, menuItem?.bookingIdleRedirectPath), { replace: true })
    },
  })

  useEffect(() => {
    checkIdleTimeoutRef.current = checkIdleTimeout
  }, [checkIdleTimeout])

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

  const showHorizonHint =
    typeof horizonDays === "number" && horizonMaxDate !== null
  const dateFeedback =
    dateRejection === "before"
      ? t("tenantPortal.agenda.dateBeforeToday")
      : dateRejection === "after"
        ? t("tenantPortal.agenda.horizonExceeded")
        : horizonAdjusted
          ? t("tenantPortal.agenda.horizonAdjusted")
          : null
  const dateDescribedBy =
    [
      showHorizonHint ? horizonHintId : null,
      dateFeedback ? dateFeedbackId : null,
    ]
      .filter((item) => item !== null)
      .join(" ") || undefined

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
      schedulePending || slotsError ||
      !selectedAsset ||
      !selectedSlot ||
      !spaceState(selectedAsset.id).available ||
      submittingRef.current ||
      quote.status === "loading" ||
      quoteUnavailable
    ) {
      return
    }
    const asset = selectedAsset
    const slot = selectedSlot
    const dayDate = date
    const generation = getAgendaSessionGeneration()

    const applyReservationSuccess = (reservation: PortalReservation) => {
      rememberOwnBooking(reservation)
      toast.success(
        t("tenantPortal.agenda.reserveSuccessWithTotal", {
          amount: formatBookingMoney(reservation.totalAmount),
          status: t(`rentals.reservations.statuses.${reservation.status}`, {
            defaultValue: reservation.status,
          }),
        }),
      )
      setMine((current) => [
        reservation,
        ...current.filter((currentReservation) => currentReservation.id !== reservation.id),
      ])
      if (viewedDateRef.current === dayDate) {
        setSlots((current) => dropScheduleSlot(current, slot))
        setSelectedRentalAssetId(null)
      }
    }

    const reservationForSlot = (
      reservations: readonly PortalReservation[],
    ): PortalReservation | null => {
      const targetKey = agendaReservedSlotKey(
        dayDate,
        slot.rentalAssetId,
        slot.startTime,
      )
      return reservations.find((reservation) => {
        if (!isBlockingReservationStatus(reservation.status)) {
          return false
        }
        const start = reservationCivilStart(reservation.startDateTime)
        return start !== null && reservation.items.some((item) =>
          agendaReservedSlotKey(start.date, item.rentalAssetId, start.time) === targetKey,
        )
      }) ?? null
    }

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
        {
          date: dayDate,
          rentalAssetId: slot.rentalAssetId,
          startTime: slot.startTime,
        },
      )
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
      applyReservationSuccess(created)
    } catch (error) {
      if (
        generation !== getAgendaSessionGeneration()
        || ((error instanceof DOMException || error instanceof Error)
          && error.name === "AbortError")
      ) {
        return
      }
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
            if (generation !== getAgendaSessionGeneration()) {
              return
            }
            setMine(reservations)
          } catch {
            // Keep the list already on screen when Minhas reservas cannot refresh.
          }
        }
        if (generation !== getAgendaSessionGeneration()) {
          return
        }
        const heldByCustomer = customerAlreadyHoldsSlot(
          dayDate,
          slot.rentalAssetId,
          slot.startTime,
          reservations,
        )
        const existingReservation = heldByCustomer
          ? reservationForSlot(reservations)
          : null
        if (existingReservation) {
          // The request may have timed out after the API created the booking.
          // `/mine` is scoped to this customer, so this conflict is success.
          applyReservationSuccess(existingReservation)
          return
        }
        if (heldByCustomer) {
          toast.error(
            <SlotHeldByYouNotice
              href={`${location.pathname}${location.search}${CUSTOMER_MY_RESERVATIONS_HASH}`}
            />,
          )
        }
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
          if (heldByCustomer) {
            setSelectedRentalAssetId(null)
          } else {
            clearUnavailableSelection(true)
          }
        }
        return
      }
      if (isSlotUnavailableConflict(error)) {
        if (viewedDateRef.current === dayDate) {
          setSlots((current) => dropScheduleSlot(current, slot))
          clearUnavailableSelection(true)
        }
        return
      }
      toast.error(
        describeBookingError(error, t("tenantPortal.agenda.reserveError")),
      )
    } finally {
      if (generation === getAgendaSessionGeneration()) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }

  async function onJoinAndReserve() {
    if (schedulePending || slotsError || !selectedSlot ||
      !spaceState(selectedSlot.rentalAssetId).available ||
      submittingRef.current || joinAndReserveLock.current || quoteUnavailable) {
      return
    }
    const generation = getAgendaSessionGeneration()
    joinAndReserveLock.current = true
    try {
      const next = await queue.join()
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
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
    const keptDate = readAgendaDateParam(searchParams.get("date"), date)
    const existing = mine.find((reservation) => reservation.id === id) ?? null
    const seenRevision = getAgendaQueryRevision()
    const generation = getAgendaSessionGeneration()
    cancelingRef.current = true
    setCancelingId(id)
    try {
      let current = existing
      try {
        const fresh = await listMyPortalReservations()
        if (generation !== getAgendaSessionGeneration()) {
          return
        }
        const freshRow =
          fresh.find((reservation) => reservation.id === id) ?? null
        if (getAgendaQueryRevision() === seenRevision) {
          releaseCancelledOwnSlots(fresh)
          const merged = mergeServerReservations(mineRef.current, fresh)
          mineRef.current = merged
          setMine(merged)
          current = merged.find((reservation) => reservation.id === id) ?? null
        } else if (
          freshRow !== null &&
          isCancelledReservationStatus(freshRow.status)
        ) {
          current = freshRow
          setMine((rows) =>
            rows.map((row) => (row.id === freshRow.id ? freshRow : row)),
          )
        }
      } catch (error) {
        if (error instanceof PortalSessionExpiredError) throw error
        // The cancel request still runs. The API remains the authority.
      }
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
      if (current !== null && isCancelledReservationStatus(current.status)) {
        forgetOwnBooking(current)
        forgetRecentReservation(current.id)
        toast.message(t("tenantPortal.agenda.alreadyCancelled"))
        setPendingCancelId(null)
        refreshAgenda(agendaRefreshDates(viewedDate, [current]))
        return
      }
      const canceled = await cancelMyPortalReservation(id)
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
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
      forgetRecentReservation(canceled.id)
      refreshAgenda(
        agendaRefreshDates(
          viewedDate,
          existing === null ? [canceled] : [existing, canceled],
        ),
      )
    } catch (error) {
      if (generation !== getAgendaSessionGeneration()) {
        return
      }
      if (error instanceof PortalSessionExpiredError) {
        notifyPortalSessionExpired()
        return
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t("apiErrors.cancelReservation"),
      )
      void listMyPortalReservations()
        .then((fresh) => {
          if (
            generation !== getAgendaSessionGeneration() ||
            getAgendaQueryRevision() !== seenRevision
          ) {
            return
          }
          releaseCancelledOwnSlots(fresh)
          const merged = mergeServerReservations(mineRef.current, fresh)
          mineRef.current = merged
          setMine(merged)
          const row =
            merged.find((reservation) => reservation.id === id) ?? null
          if (row !== null && isCancelledReservationStatus(row.status)) {
            forgetOwnBooking(row)
            forgetRecentReservation(row.id)
            setPendingCancelId(null)
            refreshAgenda(agendaRefreshDates(viewedDate, [row]))
          }
        })
        .catch(() => {
          // The error toast already reported the failure.
        })
    } finally {
      cancelingRef.current = false
      if (generation === getAgendaSessionGeneration()) {
        setCancelingId(null)
        viewedDateRef.current = keptDate
        setDate(keptDate)
      }
    }
  }

  function commitAgendaDate(nextDate: string) {
    viewedDateRef.current = nextDate
    if (nextDate === date) {
      setDate(nextDate)
      return
    }
    setSlotsLoading(true)
    setSlotsError(false)
    setPastSlotsHidden(false)
    setSlots([])
    setObservedSlots([])
    setSlotsBelongToDate(nextDate)
    setSelectedRentalAssetId(null)
    setDate(nextDate)
  }

  function onDateChange(value: string, source: LocaleDateChangeSource = "input") {
    const today = brazilTodayIsoDate()
    const attempt =
      source === "input"
        ? clampTypedDateToHorizon(value, today, horizonMaxDate)
        : classifyAgendaDateAttempt(value, today, horizonMaxDate)
    if (attempt.status === "empty" || attempt.status === "invalid") {
      return
    }
    if (attempt.status === "before" || attempt.status === "after") {
      setDateRejection(attempt.status)
      return
    }
    setHorizonAdjusted(false)
    if (attempt.status === "clamp") {
      setDateRejection("after")
      commitAgendaDate(attempt.date)
      return
    }
    setDateRejection(null)
    commitAgendaDate(attempt.date)
  }

  function spaceState(rentalAssetId: string) {
    if (schedulePending || slotsError) {
      return {
        available: false,
        disabled: true,
        selected: false,
        pending: true,
        detail: t(slotsError ? "tenantPortal.agenda.slotsError" : "common.refreshing"),
      }
    }
    const slot = startTime
      ? findSlotAtStart(slotsForView, rentalAssetId, startTime)
      : undefined
    const reservedKey =
      startTime.length > 0
        ? agendaReservedSlotKey(date, rentalAssetId, startTime)
        : ""
    const ownReservation = customerAlreadyHoldsSlot(date, rentalAssetId, startTime, mine)
    const reserved =
      reservedKey.length > 0 &&
      (optimisticReservedKeys.has(reservedKey) ||
        derivedReservedKeys.has(reservedKey) ||
        ownReservation ||
        isPortalBookingInFlight(date, rentalAssetId, startTime))
    const available = Boolean(slot) && !reserved
    // Selecting a queued Location opens its waiting room even without a slot.
    // Availability still controls booking; queue access only controls selection.
    const queueSelectable = isLocationQueueEnabled(
      visibleAssets.find((asset) => asset.id === rentalAssetId),
    )
    const detail =
      startTime.length === 0 || available
        ? null
        : t(ownReservation ? "tenantPortal.agenda.yourReservation" : "tenantPortal.agenda.slotTaken")
    return {
      available,
      disabled: !available && !queueSelectable,
      selected: (available || queueSelectable) && selectedRentalAssetId === rentalAssetId,
      pending: false,
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
                locale={moneyLocale}
                today={brazilTodayIsoDate()}
                min={brazilTodayIsoDate()}
                max={horizonMaxDate ?? undefined}
                value={date}
                onBlur={() => onDateChange(date, "calendar")}
                invalid={dateRejection !== null}
                describedBy={dateDescribedBy}
                onChange={(nextValue, source) => {
                  onDateChange(nextValue, source)
                }}
              />
              {typeof horizonDays === "number" && horizonMaxDate !== null ? (
                <p id={horizonHintId} className="text-xs text-muted-foreground">
                  {t("tenantPortal.agenda.horizonHint", {
                    date: formatLocaleCivilDayMonth(horizonMaxDate, moneyLocale),
                    count: horizonDays,
                  })}
                </p>
              ) : null}
              {dateFeedback ? (
                <p
                  id={dateFeedbackId}
                  className="text-xs text-muted-foreground"
                  role="status"
                >
                  {dateFeedback}
                </p>
              ) : null}
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
                  preferredTimeRef.current = value
                  setStartTime(value)
                  setSelectedRentalAssetId(null)
                }}
                items={timeItems}
                disabled={
                  schedulePending || slotsError || timeWindows.length === 0
                }
              >
                <SelectTrigger className="w-full" aria-busy={schedulePending}>
                  <SelectValue
                    placeholder={
                      schedulePending
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

          {schedulePending ? (
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
                  pending: inVisibleSet && state.pending,
                  selected: inVisibleSet && state.selected,
                  detail: inVisibleSet ? state.detail : null,
                }
              })}
              onSelect={selectRentalAsset}
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
                      aria-busy={state.pending || undefined}
                      aria-label={
                        state.detail
                          ? `${asset.name}. ${state.detail}`
                          : asset.name
                      }
                      className={cn(
                        "rounded-lg border px-3 py-4 text-sm font-medium",
                        state.pending && portalPickPendingClass,
                        !state.pending &&
                          state.available &&
                          state.selected &&
                          portalPickAvailableSelectedClass,
                        !state.pending &&
                          state.available &&
                          !state.selected &&
                          portalPickAvailableClass,
                        !state.pending &&
                          !state.available &&
                          portalPickUnavailableClass,
                      )}
                      onClick={() => {
                        selectRentalAsset(asset.id)
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
                disabled={queue.view.joinAndReserve && (
                  schedulePending || slotsError || !selectedSlot ||
                  !spaceState(selectedSlot.rentalAssetId).available ||
                  quoteUnavailable
                )}
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
                amount: formatBookingMoney(quote.amount),
              })}
            </p>
          ) : null}

          {!schedulePending && quote.status === "ready" && quote.amount === null ? (
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
              schedulePending || slotsError ||
              !selectedSlot ||
              (selectedRentalAssetId !== null &&
                !spaceState(selectedRentalAssetId).available) ||
              !queue.canReserve ||
              quote.status === "loading" ||
              quoteUnavailable
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
                          amount: formatBookingMoney(reservation.totalAmount),
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
