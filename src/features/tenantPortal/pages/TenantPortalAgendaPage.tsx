import { bookingEndClock } from "@/lib/tenantTimeZone"
import { PortalSessionExpiredError, notifyPortalSessionExpired } from "@/features/tenantPortal/lib/portalSessionError"
import { CalendarIcon, Check, CheckCheck, Loader2, Minus, Plus } from "lucide-react"
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

import { PageHeader } from "@/components/layout/PageHeader"
import { FormSkeleton } from "@/components/loading/PageContentSkeleton"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
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
  isCustomerBookableSlot,
  normalizeClock,
  orderByResourceName,
  pickCustomerLayout,
} from "@/features/rentals/components/layout/layoutCanvasModel"
import {
  buildMultiSlotWindows,
  findSlotAtStartAndDuration,
  formatDurationLabel,
  listDistinctDurations,
  listStartTimesForDuration,
  resolveEffectiveDuration,
} from "@/features/tenantPortal/lib/agendaDurationSelection"
import { formatTenantTimeZoneLabel } from "@/features/tenantPortal/lib/tenantTimeZoneLabel"
import {
  portalPickAvailableClass,
  portalPickAvailableSelectedClass,
  portalPickOwnReservationClass,
  portalPickPendingClass,
  portalPickUnavailableClass,
} from "@/features/rentals/components/layout/portalPickStyles"
import {
  addCivilDays,
  civilDaysBetween,
  effectiveHorizonMaxDate,
  horizonEndDate,
  resolveAgendaHorizonDays,
} from "@/features/rentals/lib/bookingHorizon"
import { fetchPublicBookingPolicy } from "@/features/rentals/services/bookingPolicyService"
import { fetchPublicRentalLayouts } from "@/features/rentals/services/rentalLayoutService"
import { formatReservationRange } from "@/features/rentals/services/reservationsService"
import { fetchDailyAvailability, type DailyAvailability } from "@/features/rentals/services/resourceVisualService"
import {
  CUSTOMER_MY_RESERVATIONS_HASH,
  localizedCustomerMenuLabel,
} from "@/features/catalog/customerNav"
import type { CustomerAppOutletContext } from "@/features/tenantPortal/components/CustomerAppLayout"
import { SlotHeldByYouNotice } from "@/features/tenantPortal/components/SlotHeldByYouNotice"
import { BookingMapExperience } from "@/features/tenantPortal/components/BookingMapExperience"
import { useRefreshOnForeground } from "@/features/tenantPortal/hooks/useRefreshOnForeground"
import { useBookingIdleTimeout } from "@/features/tenantPortal/hooks/useBookingIdleTimeout"
import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import {
  clearAgendaSelectionNotice,
  readAgendaSelectionNotice,
  showAgendaSelectionNotice,
} from "@/features/tenantPortal/lib/agendaSelectionNotice"
import { bookingIdleRedirectTarget } from "@/features/tenantPortal/lib/bookingIdleSettings"
import {
  agendaRefreshDates,
  agendaReservedSlotKey,
  customerHeldSlotQuantity,
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
import {
  formatTenantDate,
  formatTenantTime,
  resolveTenantTimeZone,
  tenantTodayIsoDate,
} from "@/lib/tenantTimeZone"
import type { PricingUnit } from "@/api/generated/rentalPricing"
import appI18n from "@/lib/i18n"
import { formatLocaleCivilDayMonth, formatLocaleCurrency } from "@/lib/localeFormat"
import { formatUnitPriceText, reservationUnitWording, unitPriceForWindow } from "@/lib/pricingUnitText"
import { cn } from "@/lib/utils"

function isCancelledReservationStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === "cancelled" || normalized === "canceled"
}

function reservationStatusBadgeVariant(
  status: string,
): "success" | "destructive" | "secondary" | "warning" {
  if (isCancelledReservationStatus(status)) {
    return "destructive"
  }
  const normalized = status.trim().toLowerCase()
  if (normalized === "confirmed") {
    return "success"
  }
  if (normalized === "pendingdeposit") {
    return "warning"
  }
  return "secondary"
}

/** Day + short month in the tenant clock — the calendar chip on a reservation card. */
function reservationDateParts(
  startDateTime: string,
  timeZoneId: string,
  locale: string,
): { day: string; month: string } {
  const date = new Date(startDateTime)
  if (Number.isNaN(date.getTime())) {
    return { day: "--", month: "" }
  }
  const zone = resolveTenantTimeZone(timeZoneId)
  const day = date.toLocaleDateString(locale, { day: "2-digit", timeZone: zone })
  const month = date
    .toLocaleDateString(locale, { month: "short", timeZone: zone })
    .replace(".", "")
  return { day, month: month.toUpperCase() }
}

function dropScheduleSlot(
  current: readonly PortalScheduleSlot[],
  slot: PortalScheduleSlot,
): PortalScheduleSlot[] {
  return current.filter(
    (candidate) =>
      !(
        candidate.rentalAssetId === slot.rentalAssetId &&
        // Overlap, not exact match: a multi-slot window (e.g. 08:00–09:30)
        // must also drop the 30-min cells it covers.
        candidate.startTime < slot.endTime &&
        candidate.endTime > slot.startTime
      ),
  )
}

function partitionAgendaSlots(
  daySlots: readonly PortalScheduleSlot[],
  dayDate: string,
  timeZoneId: string,
) {
  const observed = withoutPastTenantSlots(dayDate, daySlots, timeZoneId)
  const bookableIncludingPast = daySlots.filter(isCustomerBookableSlot)
  const bookable = withoutPastTenantSlots(
    dayDate,
    bookableIncludingPast,
    timeZoneId,
  )
  return {
    observed,
    bookable,
    pastHidden: bookable.length < bookableIncludingPast.length,
  }
}

function isCancelDeadlinePassed(reservation: PortalReservation | undefined): boolean {
  return reservation?.cancelDeadlineUtc != null && Date.now() > Date.parse(reservation.cancelDeadlineUtc)
}

/**
 * Hours between the cancel deadline and the reservation start. The API
 * does not expose a resource/category/tenant policy source, only this
 * resolved deadline — so this is the only "where it comes from" text we
 * can show without inventing data.
 */
function effectiveCancelCutoffHours(reservation: PortalReservation | undefined): number | null {
  if (!reservation?.cancelDeadlineUtc) {
    return null
  }
  const hours = Math.round(
    (Date.parse(reservation.startDateTime) - Date.parse(reservation.cancelDeadlineUtc)) / 3_600_000,
  )
  return Number.isFinite(hours) && hours > 0 ? hours : null
}

const MAX_MULTI_DAY_SPAN = 31

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
  const { subdomain, primary, menu, branding } =
    useOutletContext<CustomerAppOutletContext>()
  const timeZoneId = useTenantTimeZone()
  const signedIn = isCustomerSignedInForTenant(subdomain)

  const menuItem = useMemo(
    () => menu.find((item) => item.id === menuItemId) ?? null,
    [menu, menuItemId],
  )

  const lockedAssetId = menuItem?.assetId ?? null
  const lockedRentalAssetId = menuItem?.rentalAssetId ?? null

  const [assets, setAssets] = useState<PortalRentalAsset[]>([])
  const assetsRef = useRef<PortalRentalAsset[]>([])
  const [mine, setMine] = useState<PortalReservation[]>(() =>
    recentPortalReservations(subdomain),
  )
  const [cancelClock, setCancelClock] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setCancelClock(Date.now())
    const now = Date.now()
    const nextDeadline = Math.min(...mine.flatMap((reservation) => {
      const deadline = reservation.cancelDeadlineUtc ? Date.parse(reservation.cancelDeadlineUtc) : NaN
      return deadline >= now ? [deadline] : []
    }))
    const timer = Number.isFinite(nextDeadline)
      ? window.setTimeout(refresh, Math.min(nextDeadline - now + 1, 2_147_483_647))
      : undefined
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [mine, cancelClock])
  const mineRef = useRef(mine)
  mineRef.current = mine
  const [slots, setSlots] = useState<PortalScheduleSlot[]>([])
  const [observedSlots, setObservedSlots] = useState<PortalScheduleSlot[]>([])
  const [optimisticReservedKeys, setOptimisticReservedKeys] = useState<
    ReadonlySet<string>
  >(() => new Set())
  const [date, setDate] = useState(() =>
    readAgendaDateParam(
      searchParams.get("date"),
      tenantTodayIsoDate(timeZoneId),
      timeZoneId,
    ),
  )
  const [slotsBelongToDate, setSlotsBelongToDate] = useState(date)
  const [pastSlotsHidden, setPastSlotsHidden] = useState(false)
  const [startTime, setStartTime] = useState(
    () => readAgendaTimeParam(searchParams.get("time")) ?? "",
  )
  const preferredTimeRef = useRef(startTime)
  const [selectedDuration, setSelectedDuration] = useState<number | null>(
    null,
  )
  const preferredDurationRef = useRef<number | null>(null)
  const preserveUnavailableDurationRef = useRef(false)
  const [preserveUnavailableDuration, setPreserveUnavailableDuration] =
    useState(false)
  const skipTimeResetRef = useRef(false)
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
  useEffect(() => {
    // A fresh agenda load has no selection, so an "unavailable" notice stored
    // by an earlier visit (sessionStorage survives F5) no longer applies.
    if (readAgendaSelectionNotice(subdomain) === "unavailable") {
      clearAgendaSelectionNotice(subdomain)
    }
  }, [subdomain])
  const [quantity, setQuantity] = useState(1)
  const [lastAvailableQuantity, setLastAvailableQuantity] = useState<number | null>(null)
  const [days, setDays] = useState(1)
  const [lastPricingUnit, setLastPricingUnit] = useState<
    PricingUnit | null | undefined
  >(undefined)
  const selectRentalAsset = useCallback((rentalAssetId: string) => {
    clearAgendaSelectionNotice(subdomain)
    setQuantity(1)
    setLastAvailableQuantity(null)
    setDays(1)
    setLastPricingUnit(undefined)
    selectionRef.current = rentalAssetId
    setSelectedRentalAssetId(rentalAssetId)
  }, [subdomain])
  const [loading, setLoading] = useState(true)
  const [mapUiUnavailable, setMapUiUnavailable] = useState(false)
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
    | {
        status: "ready"
        amount: number | null
        pricingUnit: PricingUnit | null
        availableQuantity: number
        quantity: number
        selectionKey: string
      }
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

  // Tile price footer ("R$ X/hora") for the legacy grid — the rental-asset list
  // itself carries no pricing, so this mirrors BookingMapExperience's own fetch.
  const [tileAvailability, setTileAvailability] = useState<DailyAvailability | null>(null)
  const tileRentalAssetIds = useMemo(
    () => visibleAssets.map((asset) => asset.id),
    [visibleAssets],
  )
  useEffect(() => {
    if (branding.newBookingUiEnabled || tileRentalAssetIds.length === 0) {
      // Clears stale pricing when the legacy grid isn't in play; no cascading update.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTileAvailability(null)
      return
    }
    let cancelled = false
    void fetchDailyAvailability(subdomain, date, tileRentalAssetIds)
      .then((result) => {
        if (!cancelled) setTileAvailability(result)
      })
      .catch(() => {
        if (!cancelled) setTileAvailability(null)
      })
    return () => {
      cancelled = true
    }
  }, [branding.newBookingUiEnabled, date, subdomain, tileRentalAssetIds])
  const tilePriceTextById = useMemo(() => {
    const byId = new Map<string, string>()
    for (const resource of tileAvailability?.resources ?? []) {
      const window =
        resource.windows.find((candidate) => candidate.state === "Available" && candidate.totalAmount !== null) ??
        resource.windows.find((candidate) => candidate.state !== "Past")
      const unitPrice = window ? unitPriceForWindow(window) : null
      if (unitPrice) {
        const priceText = formatUnitPriceText(unitPrice.amount, unitPrice.unit, tileAvailability?.currency ?? "BRL", moneyLocale, t, "bookingMap.prices")
        // NBSP between the currency symbol and the amount so the tile footer
        // never line-wraps mid-price (e.g. "R$" alone on one line).
        byId.set(resource.rentalAssetId, priceText.replace(/(\p{Sc}) /u, "$1\u00a0").replace(/ (\p{Sc})/u, "\u00a0$1"))
      }
    }
    return byId
  }, [moneyLocale, t, tileAvailability])

  const queueAssetIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    queueAssetIdsRef.current = new Set(
      visibleAssets.filter(isLocationQueueEnabled).map((asset) => asset.id),
    )
  }, [visibleAssets])

  // The hint/redirect use the selected resource's own horizon so they never
  // contradict a per-resource availability check; with nothing selected yet,
  // fall back to the widest horizon among the visible resources.
  const selectedHorizonAsset = selectedRentalAssetId
    ? visibleAssets.find((asset) => asset.id === selectedRentalAssetId)
    : undefined
  const horizonDays = resolveAgendaHorizonDays(
    selectedHorizonAsset ? [selectedHorizonAsset] : visibleAssets,
    policyHorizonDays,
  )
  // Computing this from `policyHorizonDays` alone before resources finish loading
  // can be narrower than the resources' real horizon, clamping deep links by load
  // order instead of deterministically — so it stays `null` until resources load.
  const horizonMaxDate = effectiveHorizonMaxDate(
    !loading,
    tenantTodayIsoDate(timeZoneId),
    horizonDays,
  )
  const dayFetchGate =
    horizonMaxDate !== null && date > horizonMaxDate
      ? "hold"
      : !bookingPolicyReady && date > tenantTodayIsoDate(timeZoneId)
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
        assetsRef.current = assetList
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
        const selected = partitionAgendaSlots(day.slots, date, timeZoneId)
        setSlots(selected.bookable)
        setObservedSlots(selected.observed)
        setPastSlotsHidden(selected.pastHidden)
        setOptimisticReservedKeys((current) =>
          withoutBookableReservedKeys(current, date, selected.bookable),
        )
        const bookableWithMultiSlotWindows = [
          ...selected.bookable,
          ...buildMultiSlotWindows(selected.bookable, assetsRef.current),
        ]
        const durations = listDistinctDurations(bookableWithMultiSlotWindows)
        const durationOptions =
          !preserveUnavailableDurationRef.current ||
          preferredDurationRef.current === null
            ? durations
            : [...new Set([...durations, preferredDurationRef.current])].sort(
                (left, right) => left - right,
              )
        const effectiveDuration = resolveEffectiveDuration(
          durationOptions,
          preferredDurationRef.current,
        )
        preferredDurationRef.current = effectiveDuration
        setSelectedDuration(effectiveDuration)
        const times =
          effectiveDuration === null
            ? []
            : listStartTimesForDuration(
                bookableWithMultiSlotWindows,
                effectiveDuration,
              )
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
  }, [clearUnavailableSelection, date, dayFetchGate, menuItemId, signedIn, slotReloadNonce, subdomain, timeZoneId])

  useEffect(() => {
    const today = tenantTodayIsoDate(timeZoneId)
    const current = searchParams.toString()
    const urlDate = readAgendaDateParam(
      searchParams.get("date"),
      today,
      timeZoneId,
    )
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
    timeZoneId,
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
      const selected = partitionAgendaSlots(
        match.day.slots,
        viewed,
        timeZoneId,
      )
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
  }, [subdomain, timeZoneId])

  const schedulePending = slotsLoading || slotsBelongToDate !== date
  const slotsForView = useMemo(
    () => {
      const bookableSlots = slotsBelongToDate === date ? slots : []
      return [...bookableSlots, ...buildMultiSlotWindows(bookableSlots, assets)]
    },
    [assets, date, slots, slotsBelongToDate],
  )
  const observedForView = useMemo(
    () => (slotsBelongToDate === date ? observedSlots : []),
    [date, observedSlots, slotsBelongToDate],
  )
  const derivedReservedKeys = useMemo(
    () => reservedSlotKeysForDate(date, mine, observedForView, timeZoneId),
    [date, mine, observedForView, timeZoneId],
  )
  const availableDurations = useMemo(
    () => listDistinctDurations(slotsForView),
    [slotsForView],
  )
  const durationOptions = useMemo(
    () =>
      !preserveUnavailableDuration ||
      selectedDuration === null ||
      availableDurations.includes(selectedDuration)
        ? availableDurations
        : [...availableDurations, selectedDuration].sort(
            (left, right) => left - right,
          ),
    [availableDurations, preserveUnavailableDuration, selectedDuration],
  )
  const selectedDurationUnavailable =
    preserveUnavailableDuration &&
    selectedDuration !== null &&
    !availableDurations.includes(selectedDuration)
  const effectiveDuration = useMemo(
    () => resolveEffectiveDuration(durationOptions, selectedDuration),
    [durationOptions, selectedDuration],
  )
  const timeWindows = useMemo(
    () =>
      effectiveDuration === null
        ? []
        : listStartTimesForDuration(slotsForView, effectiveDuration),
    [slotsForView, effectiveDuration],
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
    if (schedulePending || slotsError) {
      return
    }
    if (timeWindows.length === 0) {
      if (selectedDurationUnavailable && startTime.length > 0) {
        skipTimeResetRef.current = false
        preferredTimeRef.current = ""
        setStartTime("")
      }
      return
    }
    if (timeWindows.some((window) => window.startTime === startTime)) {
      return
    }
    if (skipTimeResetRef.current) {
      // The booking just removed the chosen slot from this list. Keep the
      // customer's time selection instead of jumping to the day's first slot.
      skipTimeResetRef.current = false
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
  }, [
    clearUnavailableSelection,
    schedulePending,
    selectedDurationUnavailable,
    slotsError,
    startTime,
    subdomain,
    timeWindows,
  ])

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

  const selectedSlot = selectedRentalAssetId && effectiveDuration !== null
    ? findSlotAtStartAndDuration(
        slotsForView,
        selectedRentalAssetId,
        startTime,
        effectiveDuration,
      )
    : undefined
  const selectedAsset = visibleAssets.find(
    (asset) => asset.id === selectedRentalAssetId,
  )
  const quoteAssetId = selectedAsset?.assetId ?? null
  const quoteStart = selectedSlot?.startTime.slice(0, 5) ?? null
  const quoteEnd = (selectedSlot ? bookingEndClock(selectedSlot.endTime) : null)
  const isDayPricing = lastPricingUnit === "Day" &&
    (selectedAsset?.schedulePolicy ?? "").toLowerCase() === "openhours"
  const daysRemainingToHorizon = horizonMaxDate === null
    ? MAX_MULTI_DAY_SPAN
    : Math.max(1, civilDaysBetween(date, horizonMaxDate) + 1)
  const daysMax = Math.min(MAX_MULTI_DAY_SPAN, daysRemainingToHorizon)

  useEffect(() => {
    if (days <= daysMax) {
      return
    }
    // The tenant policy may arrive after a multi-day quote was selected.
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setDays(daysMax)
        setQuote({ status: "idle" })
      }
    })
    return () => {
      cancelled = true
    }
  }, [days, daysMax])

  const endDate = isDayPricing && days > 1 ? addCivilDays(date, days - 1) : undefined
  const quoteSelectionKey = quoteAssetId && quoteStart && quoteEnd
    ? `${date}:${endDate ?? ""}:${quoteAssetId}:${quoteStart}:${quoteEnd}:${quantity}`
    : null
  const selectedAssetQuantity = selectedAsset?.totalQuantity ?? 1
  const isMultiUnitGood = selectedAsset !== undefined &&
    selectedAsset.type.toLowerCase() === "good" && selectedAssetQuantity > 1
  const quantityMax = isMultiUnitGood
    ? Math.max(1, Math.min(selectedAssetQuantity, lastAvailableQuantity ?? selectedAssetQuantity))
    : 1
  const quoteCurrent = quote.status === "ready" && quote.selectionKey === quoteSelectionKey
  const quoteUnavailable = quoteCurrent && quote.amount === null

  useEffect(() => {
    if (!quoteAssetId || !quoteStart || !quoteEnd || quoteSelectionKey === null) {
      setQuote({ status: "idle" })
      return
    }

    let cancelled = false
    const selectionKey = quoteSelectionKey
    setQuote({ status: "loading" })
    void checkPortalAvailability(subdomain, {
      assetId: quoteAssetId,
      date,
      endDate,
      startTime: quoteStart,
      endTime: quoteEnd,
      quantity,
    })
      .then((result) => {
        if (cancelled) {
          return
        }
        setLastAvailableQuantity(result.availableQuantity)
        // An unavailable multi-day quote comes back without a pricing unit; keeping the
        // last known unit stops the Dias selector from unmounting and re-quoting in a loop.
        if (result.pricingUnit != null || !endDate) {
          setLastPricingUnit(result.pricingUnit)
        }
        if (result.availableQuantity > 0 && result.availableQuantity < quantity) {
          setQuantity(Math.max(1, result.availableQuantity))
        }
        setQuote({
          status: "ready",
          amount: result.isAvailable ? result.estimatedTotalAmount : null,
          pricingUnit: result.pricingUnit ?? null,
          availableQuantity: result.availableQuantity,
          quantity,
          selectionKey,
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
  }, [date, endDate, quantity, quoteAssetId, quoteEnd, quoteSelectionKey, quoteStart, subdomain])

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
      if (!isPastTenantSlotStart(date, selectedSlot.startTime, timeZoneId)) {
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
  }, [
    clearUnavailableSelection,
    date,
    selectedRentalAssetId,
    selectedSlot,
    timeZoneId,
  ])

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
      { subdomain, dates: [day], timeZoneId },
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
  const pendingCancelReservation = mine.find(
    (reservation) => reservation.id === pendingCancelId,
  )
  const pendingCancelWording = pendingCancelReservation
    ? reservationTotalWording(pendingCancelReservation, true)
    : { totalText: "", unitPriceText: null, multiplierText: null }

  function refreshAgenda(dayDates: readonly string[]) {
    void invalidateAgendaQueries(
      { subdomain, dates: dayDates, timeZoneId },
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
      !quoteCurrent ||
      quoteUnavailable
    ) {
      return
    }
    const asset = selectedAsset
    const slot = selectedSlot
    const dayDate = date
    const generation = getAgendaSessionGeneration()
    const quotePricingUnit = quoteCurrent ? quote.pricingUnit : null

    const applyReservationSuccess = (reservation: PortalReservation) => {
      rememberOwnBooking(reservation, timeZoneId)
      const unitPrice = unitPriceForWindow({
        startTime: slot.startTime,
        endTime: slot.endTime,
        totalAmount: reservation.totalAmount,
        pricingUnit: quotePricingUnit,
        quantity,
        days,
      })
      const unitPriceText = unitPrice
        ? formatUnitPriceText(unitPrice.amount, unitPrice.unit, "BRL", moneyLocale, t, "bookingMap.prices")
        : null
      toast.success(
        `${t("tenantPortal.agenda.reserveSuccessWithTotal", {
          amount: formatBookingMoney(reservation.totalAmount),
          status: t(`rentals.reservations.statuses.${reservation.status}`, {
            defaultValue: reservation.status,
          }),
        })}${unitPriceText ? ` (${unitPriceText})` : ""} · ${formatTenantTimeZoneLabel(branding.timeZoneId, moneyLocale, reservation.startDateTime)}`,
      )
      setMine((current) => [
        reservation,
        ...current.filter((currentReservation) => currentReservation.id !== reservation.id),
      ])
      if (viewedDateRef.current === dayDate) {
        skipTimeResetRef.current = true
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
        const start = reservationCivilStart(
          reservation.startDateTime,
          timeZoneId,
        )
        return start !== null && reservation.items.some((item) =>
          agendaReservedSlotKey(start.date, item.rentalAssetId, start.time) === targetKey &&
          (item.quantity ?? 1) === quantity,
        )
      }) ?? null
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      const created = await commitPortalBooking(
        () =>
          canBookViaSlotId(slot) && !endDate
            ? bookPortalSlot({
                slotId: slot.id,
                unitId: asset.unitId,
                quantity,
                expectedTotalAmount: quoteCurrent ? quote.amount : null,
              })
            : createPortalReservation({
                unitId: asset.unitId,
                date: dayDate,
                endDate,
                startTime: slot.startTime.slice(0, 5),
                endTime: bookingEndClock(slot.endTime),
                items: [{ assetId: asset.assetId, quantity }],
                expectedTotalAmount: quoteCurrent ? quote.amount : null,
              }),
        { subdomain, dates: [dayDate], timeZoneId },
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
            timeZoneId,
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
          timeZoneId,
        )
        const existingReservation = heldByCustomer
          ? reservationForSlot(reservations)
          : null
        if (existingReservation) {
          // A 409 is the API's only duplicate signal today. The matching row
          // belongs to this customer, but was created by another request/tab.
          setMine(reservations)
          toast.message(t("tenantPortal.agenda.alreadyReserved"))
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
        describeBookingError(
          error,
          t("tenantPortal.agenda.reserveError"),
          // Use the booked resource's own horizon, not the widest visible one.
          resolveAgendaHorizonDays(
            assets.filter((asset) => asset.id === slot.rentalAssetId),
            policyHorizonDays,
          ),
        ),
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
      submittingRef.current || joinAndReserveLock.current || !quoteCurrent || quoteUnavailable) {
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
    if (cancelingRef.current || isCancelDeadlinePassed(mine.find((row) => row.id === id))) {
      return
    }
    setPendingCancelId(id)
  }

  async function confirmCancel() {
    if (pendingCancelId === null || cancelingRef.current) {
      return
    }
    if (isCancelDeadlinePassed(mine.find((row) => row.id === pendingCancelId))) return
    const id = pendingCancelId
    const viewedDate = date
    const keptDate = readAgendaDateParam(
      searchParams.get("date"),
      date,
      timeZoneId,
    )
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
          releaseCancelledOwnSlots(fresh, timeZoneId)
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
        forgetOwnBooking(current, timeZoneId)
        forgetRecentReservation(current.id)
        toast.message(t("tenantPortal.agenda.alreadyCancelled"))
        setPendingCancelId(null)
        refreshAgenda(agendaRefreshDates(viewedDate, [current], timeZoneId))
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
      forgetOwnBooking(existing ?? canceled, timeZoneId)
      forgetRecentReservation(canceled.id)
      refreshAgenda(
        agendaRefreshDates(
          viewedDate,
          existing === null ? [canceled] : [existing, canceled],
          timeZoneId,
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
          releaseCancelledOwnSlots(fresh, timeZoneId)
          const merged = mergeServerReservations(mineRef.current, fresh)
          mineRef.current = merged
          setMine(merged)
          const row =
            merged.find((reservation) => reservation.id === id) ?? null
          if (row !== null && isCancelledReservationStatus(row.status)) {
            forgetOwnBooking(row, timeZoneId)
            forgetRecentReservation(row.id)
            setPendingCancelId(null)
            refreshAgenda(agendaRefreshDates(viewedDate, [row], timeZoneId))
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
    setQuantity(1)
    setLastAvailableQuantity(null)
    setDays(1)
    setLastPricingUnit(undefined)
    setSelectedRentalAssetId(null)
    setDate(nextDate)
  }

  function onDurationChange(minutes: number) {
    if (minutes === effectiveDuration) {
      return
    }
    preserveUnavailableDurationRef.current = true
    setPreserveUnavailableDuration(true)
    preferredDurationRef.current = minutes
    setSelectedDuration(minutes)

    const timeStillOffered = listStartTimesForDuration(slotsForView, minutes).some(
      (window) => window.startTime === startTime,
    )
    if (!timeStillOffered) {
      preferredTimeRef.current = ""
      setStartTime("")
      setQuantity(1)
      setLastAvailableQuantity(null)
      setDays(1)
      setLastPricingUnit(undefined)
      selectionRef.current = null
      setSelectedRentalAssetId(null)
      return
    }

    const tileStillValid =
      selectedRentalAssetId === null ||
      findSlotAtStartAndDuration(slotsForView, selectedRentalAssetId, startTime, minutes) !== undefined
    if (!tileStillValid) {
      setQuantity(1)
      setLastAvailableQuantity(null)
      setDays(1)
      setLastPricingUnit(undefined)
      selectionRef.current = null
      setSelectedRentalAssetId(null)
    }
  }

  function onDateChange(value: string, source: LocaleDateChangeSource = "input") {
    const today = tenantTodayIsoDate(timeZoneId)
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
        ownReservation: false,
      }
    }
    const slot = startTime && effectiveDuration !== null
      ? findSlotAtStartAndDuration(
          slotsForView,
          rentalAssetId,
          startTime,
          effectiveDuration,
        )
      : undefined
    const reservedKey =
      startTime.length > 0
        ? agendaReservedSlotKey(date, rentalAssetId, startTime)
        : ""
    const ownReservation = customerAlreadyHoldsSlot(
      date,
      rentalAssetId,
      startTime,
      mine,
      timeZoneId,
    )
    const ownReservationUnits = customerHeldSlotQuantity(
      date,
      rentalAssetId,
      startTime,
      mine,
      timeZoneId,
    )
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
    const asset = visibleAssets.find((candidate) => candidate.id === rentalAssetId)
    const assetHorizonMaxDate = horizonEndDate(
      tenantTodayIsoDate(timeZoneId),
      asset ? resolveAgendaHorizonDays([asset], policyHorizonDays) : undefined,
    )
    const exceedsAssetHorizon = assetHorizonMaxDate !== null && date > assetHorizonMaxDate
    const detail =
      startTime.length === 0 || available
        ? null
        : exceedsAssetHorizon
          ? t("tenantPortal.agenda.horizonExceeded")
          : ownReservation && asset && asset.totalQuantity > 1 && ownReservationUnits > 0
            ? `${t("tenantPortal.agenda.yourReservationUnits", {
                count: ownReservationUnits,
                total: asset.totalQuantity,
              })} ${t("tenantPortal.agenda.yourReservationUnitsReason")}`
            : ownReservation
              ? t("tenantPortal.agenda.yourReservation")
              : asset && asset.totalQuantity > 1
                ? t("tenantPortal.agenda.allUnitsReserved")
                : t("tenantPortal.agenda.slotTaken")
    return {
      available,
      disabled: !available && !queueSelectable,
      selected: (available || queueSelectable) && selectedRentalAssetId === rentalAssetId,
      pending: false,
      detail,
      ownReservation,
    }
  }

  // Whether `startCandidate` is still bookable for the selected resource — used to
  // keep the Horário list from offering a start time that resource has no room for.
  // With no resource selected yet, every time the schedule offers stays selectable.
  function timeAvailableForSelectedAsset(startCandidate: string): boolean {
    if (!selectedRentalAssetId || effectiveDuration === null) {
      return true
    }
    const slot = findSlotAtStartAndDuration(
      slotsForView,
      selectedRentalAssetId,
      startCandidate,
      effectiveDuration,
    )
    const reservedKey = agendaReservedSlotKey(date, selectedRentalAssetId, startCandidate)
    const ownReservation = customerAlreadyHoldsSlot(
      date,
      selectedRentalAssetId,
      startCandidate,
      mine,
      timeZoneId,
    )
    const reserved =
      reservedKey.length > 0 &&
      (optimisticReservedKeys.has(reservedKey) ||
        derivedReservedKeys.has(reservedKey) ||
        ownReservation ||
        isPortalBookingInFlight(date, selectedRentalAssetId, startCandidate))
    return Boolean(slot) && !reserved
  }

  // The map flow books outside this page's handlers; refresh Minhas reservas
  // so the new booking shows without a reload (R8 M1).
  function refreshMineAfterMapBooking() {
    void listMyPortalReservations()
      .then((reservations) =>
        setMine(
          mergeServerReservations(
            recentPortalReservations(subdomain),
            reservations,
          ),
        ),
      )
      .catch(() => {
        // Keep the list already on screen when Minhas reservas cannot refresh.
      })
  }

  const isReservationRoute = searchParams.has("reservation") || location.hash === CUSTOMER_MY_RESERVATIONS_HASH

  if (branding.newBookingUiEnabled && !mapUiUnavailable && !isReservationRoute) {
    return <BookingMapExperience subdomain={subdomain} locale={moneyLocale} scopedAssets={visibleAssets} scoped={menuItem !== null} initialDate={date} onUnavailable={() => setMapUiUnavailable(true)} onBooked={refreshMineAfterMapBooking} />
  }

  // Same rows as `mine`, grouped for scanning — no re-fetch, no status change.
  const upcomingReservations = mine.filter(
    (reservation) =>
      !isCancelledReservationStatus(reservation.status) &&
      !isPastReservation(reservation.endDateTime),
  )
  const pastReservations = mine.filter(
    (reservation) =>
      !isCancelledReservationStatus(reservation.status) &&
      isPastReservation(reservation.endDateTime),
  )
  const cancelledReservations = mine.filter((reservation) =>
    isCancelledReservationStatus(reservation.status),
  )

  const quoteUnitPriceText =
    quoteCurrent && quote.amount !== null && selectedSlot
      ? (() => {
          const unitPrice = unitPriceForWindow({
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            totalAmount: quote.amount,
            pricingUnit: quote.pricingUnit,
            quantity,
            days,
          })
          // Fixed pricing is flat for the whole booking; the main line already shows
          // the total, so no redundant per-unit split is shown underneath it.
          return unitPrice && unitPrice.unit !== "Fixed"
            ? formatUnitPriceText(unitPrice.amount, unitPrice.unit, "BRL", moneyLocale, t, "bookingMap.prices")
            : null
        })()
      : null

  function reservationTotalWording(reservation: PortalReservation, includeSingular = false) {
    const item = reservation.items[0]
    const totalText = t("tenantPortal.agenda.total", { amount: formatBookingMoney(reservation.totalAmount) })
    if (reservation.items.length !== 1) {
      return { totalText, unitPriceText: null, multiplierText: null }
    }
    const wording = reservationUnitWording(
      {
        pricingUnit: item?.pricingUnit,
        quantity: item?.quantity,
        days: item?.days,
        startDateTime: reservation.startDateTime,
        endDateTime: reservation.endDateTime,
      },
      timeZoneId,
    )
    const unitPriceText = wording.unit && item
      ? formatUnitPriceText(
          item.unitPrice,
          wording.unit,
          "BRL",
          moneyLocale,
          t,
          "bookingMap.prices",
        )
      : null
    const multiplierParts: string[] = []
    if (wording.quantity > 1 || includeSingular) {
      multiplierParts.push(
        t("tenantPortal.agenda.reservationQuantitySuffix", { count: wording.quantity }),
      )
    }
    if (wording.days !== null && (wording.days > 1 || includeSingular)) {
      multiplierParts.push(t("tenantPortal.agenda.reservationDaysSuffix", { count: wording.days }))
    }
    return {
      totalText,
      unitPriceText,
      multiplierText: multiplierParts.length > 0 ? multiplierParts.join(" · ") : null,
    }
  }

  function renderReservationItem(reservation: PortalReservation) {
    const focused = reservation.id === focusedReservationId
    const cancelled = isCancelledReservationStatus(reservation.status)
    const dateParts = reservationDateParts(
      reservation.startDateTime,
      timeZoneId,
      moneyLocale,
    )
    const { totalText, unitPriceText, multiplierText } = reservationTotalWording(reservation)
    return (
      <li
        key={reservation.id}
        ref={focused ? focusedRowRef : undefined}
        aria-current={focused ? "true" : undefined}
        data-reservation-focused={focused ? "true" : undefined}
        className={cn(
          "scroll-mt-16 flex gap-3 rounded-xl border bg-card p-3 text-sm shadow-sm transition-shadow duration-150 ease-out motion-safe:hover:shadow-md sm:p-4",
          focused
            ? "border-primary bg-primary/10 ring-2 ring-primary"
            : "border-border",
          cancelled && "opacity-60",
        )}
      >
        <div
          aria-hidden
          className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {dateParts.month}
          </span>
          <span className="text-lg leading-none font-semibold text-foreground">
            {dateParts.day}
          </span>
        </div>
        <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold text-foreground">
            {reservation.items
              .map((item) =>
                (item.quantity ?? 1) > 1 ? `${item.assetName} ×${item.quantity}` : item.assetName,
              )
              .join(", ")}
          </p>
          <Badge variant={reservationStatusBadgeVariant(reservation.status)}>
            {t(`rentals.reservations.statuses.${reservation.status}`, {
              defaultValue: reservation.status,
            })}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatReservationRange(
            reservation.startDateTime,
            reservation.endDateTime,
            timeZoneId,
          )}
          {" · "}
          {formatTenantTimeZoneLabel(
            branding.timeZoneId,
            moneyLocale,
            reservation.startDateTime,
          )}
          {cancelled ? null : (
            <>
              {" · "}
              {totalText}
            </>
          )}
        </p>
        {!cancelled && (unitPriceText || multiplierText) ? (
          <p className="text-xs text-muted-foreground">
            {[unitPriceText, multiplierText].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {!cancelled && reservation.cancelDeadlineUtc && !isCancelDeadlinePassed(reservation) ? (
          <p className="text-xs text-muted-foreground">
            {t("tenantPortal.agenda.cancelDeadline", {
              when: `${formatTenantDate(new Date(reservation.cancelDeadlineUtc), timeZoneId, moneyLocale)} ${formatTenantTime(new Date(reservation.cancelDeadlineUtc), timeZoneId, moneyLocale)}`,
            })}
          </p>
        ) : !cancelled && !reservation.cancelDeadlineUtc && !isPastReservation(reservation.endDateTime) ? (
          <p className="text-xs text-muted-foreground">
            {t("tenantPortal.agenda.noCancelDeadline")}
          </p>
        ) : null}
        {isPastReservation(reservation.endDateTime) ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {t("tenantPortal.agenda.pastReservation")}
          </p>
        ) : null}
        {!isPastReservation(reservation.endDateTime) &&
        canCustomerSelfCancel(
          reservation.status,
          reservation.startDateTime,
        ) ? (
          isCancelDeadlinePassed(reservation) ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("tenantPortal.agenda.cancelCutoffReason")}
            </p>
          ) : (
            <LoadingButton
              type="button"
              variant="outline"
              className="mt-3 h-11"
              loading={cancelingId === reservation.id}
              loadingLabel={t("tenantPortal.agenda.cancelling")}
              onClick={() => {
                requestCancel(reservation.id)
              }}
            >
              {t("tenantPortal.agenda.cancel")}
            </LoadingButton>
          )
        ) : null}
        </div>
      </li>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title={title}
        description={t("tenantPortal.agenda.subtitlePicker")}
      />

      {loading ? (
        <FormSkeleton fields={4} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-sm">
              <label htmlFor={dateInputId}>{t("tenantPortal.agenda.date")}</label>
              <LocaleDateInput
                id={dateInputId}
                locale={moneyLocale}
                today={tenantTodayIsoDate(timeZoneId)}
                min={tenantTodayIsoDate(timeZoneId)}
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
                  setQuantity(1)
                  setLastAvailableQuantity(null)
                  setDays(1)
                  setLastPricingUnit(undefined)
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
                  {timeWindows.map((window) => {
                    const reservedForSelectedAsset = !timeAvailableForSelectedAsset(
                      window.startTime,
                    )
                    return (
                      <SelectItem
                        key={window.startTime}
                        value={window.startTime}
                        disabled={reservedForSelectedAsset}
                      >
                        {formatScheduleTime(window.startTime)} –{" "}
                        {formatScheduleTime(window.endTime)}
                        {reservedForSelectedAsset
                          ? ` · ${t("tenantPortal.agenda.timeReserved")}`
                          : ""}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </label>
            <span className="-mt-1 block text-xs text-muted-foreground sm:col-start-2">
              {formatTenantTimeZoneLabel(branding.timeZoneId, moneyLocale, date)}
            </span>
          </div>

          {durationOptions.length > 1 ? (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label={t("tenantPortal.agenda.durationLabel")}
            >
              <span className="text-sm text-muted-foreground">
                {t("tenantPortal.agenda.durationLabel")}
              </span>
              {durationOptions.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  size="sm"
                  variant={effectiveDuration === minutes ? "default" : "outline"}
                  aria-pressed={effectiveDuration === minutes}
                  disabled={schedulePending || slotsError}
                  onClick={() => onDurationChange(minutes)}
                >
                  {formatDurationLabel(minutes)}
                </Button>
              ))}
            </div>
          ) : null}

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

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-3 rounded-sm border-2 border-emerald-700 bg-emerald-500 dark:border-emerald-300" />
              {t("tenantPortal.agenda.legendAvailable")}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className="size-3 rounded-sm border-2 border-foreground/40 bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,var(--border)_2px,var(--border)_3px)]" />
              {t("tenantPortal.agenda.legendUnavailable")}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Check className="size-3 shrink-0 rounded-sm border-2 border-primary bg-primary/10 p-px text-primary" />
              {t("tenantPortal.agenda.legendSelected")}
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <CheckCheck className="size-3 shrink-0 rounded-sm border-2 border-primary/70 bg-primary/10 p-px text-primary" />
              {t("tenantPortal.agenda.yourReservation")}
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
                const baseLabel = asset?.name ?? item.rentalAssetId
                const tileLabel =
                  asset && asset.totalQuantity > 1
                    ? `${baseLabel} ${t("tenantPortal.agenda.unitsBadge", { count: asset.totalQuantity })}`
                    : baseLabel
                const priceText = tilePriceTextById.get(item.rentalAssetId)
                return {
                  key: item.rentalAssetId,
                  rentalAssetId: item.rentalAssetId,
                  label: tileLabel,
                  footer: priceText ? `${tileLabel} · ${priceText}` : null,
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
                  ownReservation: inVisibleSet && state.ownReservation,
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
                        "relative min-h-11 rounded-lg border px-3 py-4 text-left text-sm font-medium",
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
                          !state.ownReservation &&
                          portalPickUnavailableClass,
                        !state.pending &&
                          !state.available &&
                          state.ownReservation &&
                          portalPickOwnReservationClass,
                      )}
                      onClick={() => {
                        selectRentalAsset(asset.id)
                      }}
                    >
                      {!state.pending && state.available && state.selected ? (
                        <Check
                          aria-hidden
                          className="absolute top-1.5 right-1.5 size-3.5 text-primary"
                        />
                      ) : null}
                      {!state.pending && !state.available && state.ownReservation ? (
                        <CheckCheck
                          aria-hidden
                          className="absolute top-1.5 right-1.5 size-3.5 text-primary"
                        />
                      ) : null}
                      <span className="block">
                        {asset.totalQuantity > 1
                          ? `${asset.name} ${t("tenantPortal.agenda.unitsBadge", { count: asset.totalQuantity })}`
                          : asset.name}
                      </span>
                      {tilePriceTextById.get(asset.id) ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {tilePriceTextById.get(asset.id)}
                        </span>
                      ) : null}
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
                  !quoteCurrent ||
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

          {isMultiUnitGood ? (
            <div className="flex items-center gap-2" role="group" aria-label={t("bookingMap.quantity")}>
              <span className="text-sm font-medium">{t("bookingMap.quantity")}</span>
              <Button
                type="button"
                size="icon-lg"
                variant="outline"
                aria-label={`${t("bookingMap.quantity")} −`}
                disabled={quantity <= 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <output className="min-w-6 text-center tabular-nums" aria-label={t("bookingMap.quantity")}>
                {quantity}
              </output>
              <Button
                type="button"
                size="icon-lg"
                variant="outline"
                aria-label={`${t("bookingMap.quantity")} +`}
                disabled={quantity >= quantityMax}
                onClick={() => setQuantity((current) => Math.min(quantityMax, current + 1))}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("bookingMap.unitsLeft", {
                  left: Math.max(0, Math.min(selectedAssetQuantity, lastAvailableQuantity ?? selectedAssetQuantity)),
                  total: selectedAssetQuantity,
                })}
              </span>
            </div>
          ) : null}

          {isDayPricing ? (
            <div className="flex items-center gap-2" role="group" aria-label={t("tenantPortal.agenda.days")}>
              <span className="text-sm font-medium">{t("tenantPortal.agenda.days")}</span>
              <Button
                type="button"
                size="icon-lg"
                variant="outline"
                aria-label={`${t("tenantPortal.agenda.days")} −`}
                disabled={days <= 1}
                onClick={() => setDays((current) => Math.max(1, current - 1))}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <output className="min-w-6 text-center tabular-nums" aria-label={t("tenantPortal.agenda.days")}>
                {days}
              </output>
              <Button
                type="button"
                size="icon-lg"
                variant="outline"
                aria-label={`${t("tenantPortal.agenda.days")} +`}
                disabled={days >= daysMax}
                onClick={() => setDays((current) => Math.min(daysMax, current + 1))}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
              {days > 1 && endDate ? (
                <span className="text-xs text-muted-foreground">
                  {t("tenantPortal.agenda.daysSummary", {
                    count: days,
                    until: formatLocaleCivilDayMonth(endDate, moneyLocale),
                  })}
                </span>
              ) : null}
            </div>
          ) : null}

          {/* Fixed-height slot for the quote summary so the Reservar button below doesn't jump when it appears. */}
          <div className="flex min-h-11 items-center">
            {quote.status === "loading" ? (
              <p className="text-sm text-muted-foreground">
                {t("tenantPortal.agenda.quoteLoading")}
              </p>
            ) : null}

            {quoteCurrent && quote.amount !== null ? (
              <div>
                <p className="text-sm font-medium">
                  {t("tenantPortal.agenda.available", {
                    amount: formatBookingMoney(quote.amount),
                  })}
                </p>
                {quoteUnitPriceText ? (
                  <p className="text-xs text-muted-foreground">{quoteUnitPriceText}</p>
                ) : null}
              </div>
            ) : null}

            {!schedulePending && quoteUnavailable ? (
              <p className="text-sm text-muted-foreground">
                {endDate && quote.status === "ready" && quote.availableQuantity === 0
                  ? t("tenantPortal.agenda.periodIncludesBookedDay")
                  : t("tenantPortal.agenda.slotTaken")}
              </p>
            ) : null}

            {quote.status === "error" ? (
              <p className="text-sm text-muted-foreground">
                {t("tenantPortal.agenda.availabilityError")}
              </p>
            ) : null}
          </div>

          {queue.hideReserveUi ||
          (queue.view.kind === "join" && queue.view.joinAndReserve) ? null : (
          <div className="sticky bottom-0 z-10 border-t border-border bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:py-0 sm:pb-0">
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
                !quoteCurrent ||
                quoteUnavailable
              }
              onClick={() => {
                void onReserve()
              }}
            >
              {t("tenantPortal.agenda.reserveSlot")}
            </LoadingButton>
          </div>
          )}

          <div
            id="minhas-reservas"
            className="scroll-mt-16 space-y-4 border-t border-border pt-5"
          >
            <h3 className="text-lg font-semibold text-foreground">
              {t("tenantPortal.agenda.myReservations")}
            </h3>
            {mine.length === 0 ? (
              <EmptyState
                size="sm"
                icon={CalendarIcon}
                title={t("tenantPortal.agenda.empty")}
              />
            ) : (
              <>
                {upcomingReservations.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {t("tenantPortal.agenda.groupUpcoming")}
                    </h4>
                    <ul className="space-y-2">
                      {upcomingReservations.map(renderReservationItem)}
                    </ul>
                  </div>
                ) : null}
                {pastReservations.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {t("tenantPortal.agenda.groupPast")}
                    </h4>
                    <ul className="space-y-2">
                      {pastReservations.map(renderReservationItem)}
                    </ul>
                  </div>
                ) : null}
                {cancelledReservations.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {t("tenantPortal.agenda.groupCancelled")}
                    </h4>
                    <ul className="space-y-2">
                      {cancelledReservations.map(renderReservationItem)}
                    </ul>
                  </div>
                ) : null}
              </>
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
                  {t(
                    (pendingCancelReservation?.depositPaid ?? 0) > 0
                      ? "tenantPortal.agenda.cancelConfirmBodyPaid"
                      : "tenantPortal.agenda.cancelConfirmBodyUnpaid",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {pendingCancelReservation ? (
                <p className="text-sm text-muted-foreground">
                  {pendingCancelWording.totalText}
                  {pendingCancelWording.unitPriceText ? ` · ${pendingCancelWording.unitPriceText}` : ""}
                  {pendingCancelWording.multiplierText ? ` · ${pendingCancelWording.multiplierText}` : ""}
                </p>
              ) : null}
              {pendingCancelReservation?.cancelDeadlineUtc ? (
                <p className="text-sm text-muted-foreground">
                  {t("tenantPortal.agenda.cancelDeadline", {
                    when: `${formatTenantDate(new Date(pendingCancelReservation.cancelDeadlineUtc), timeZoneId, moneyLocale)} ${formatTenantTime(new Date(pendingCancelReservation.cancelDeadlineUtc), timeZoneId, moneyLocale)}`,
                  })}
                  {" · "}
                  {formatTenantTimeZoneLabel(
                    branding.timeZoneId,
                    moneyLocale,
                    pendingCancelReservation.cancelDeadlineUtc,
                  )}
                </p>
              ) : pendingCancelReservation ? (
                <p className="text-sm text-muted-foreground">
                  {t("tenantPortal.agenda.noCancelDeadline")}
                </p>
              ) : null}
              {effectiveCancelCutoffHours(pendingCancelReservation) !== null ? (
                <p className="text-sm text-muted-foreground">
                  {t("tenantPortal.agenda.cancelEffectiveCutoff", {
                    count: effectiveCancelCutoffHours(pendingCancelReservation),
                  })}
                </p>
              ) : null}
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
                <AlertDialogCancel size="lg" disabled={cancelingId !== null}>
                  {t("tenantPortal.agenda.cancelConfirmDismiss")}
                </AlertDialogCancel>
                <LoadingButton
                  type="button"
                  variant="destructive"
                  size="lg"
                  className="bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:bg-destructive/95"
                  disabled={isCancelDeadlinePassed(pendingCancelReservation)}
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
        </div>
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
