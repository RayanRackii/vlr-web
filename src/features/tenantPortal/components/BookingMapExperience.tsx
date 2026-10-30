import { bookingEndClock, displayEndClock } from "@/lib/tenantTimeZone"
/* eslint-disable react-hooks/set-state-in-effect */
import { List, Map as MapIcon, XIcon } from "lucide-react"
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { Button } from "@/components/ui/button"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import { Input } from "@/components/ui/input"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { VISUAL_ICON_MAP } from "@/features/rentals/components/layout/resourceVisualIconMap"
import { fetchDailyAvailability, fetchPublicBookingMap, fetchPublicBookingMaps, visualArtUrl, type DailyAvailability, type PublicMap } from "@/features/rentals/services/resourceVisualService"
import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import { useBookingIdleTimeout } from "@/features/tenantPortal/hooks/useBookingIdleTimeout"
import { reservationCivilStart } from "@/features/tenantPortal/lib/agendaReservationQuery"
import { isWithinCancelCutoff } from "@/features/tenantPortal/lib/cancelCutoffWarning"
import { bookPortalSlot, checkPortalAvailability, createPortalReservation, isLocationQueueEnabled, listMyPortalReservations, type PortalRentalAsset } from "@/features/tenantPortal/services/tenantPortalService"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import { formatUnitPriceText, unitPriceForWindow } from "@/lib/pricingUnitText"

import { DateStrip } from "./portal/DateStrip"
import { SegmentedControl } from "./portal/SegmentedControl"
import { PortalBookingHeader } from "./portal/PortalBookingHeader"
import { PortalBookingEmptyState, PortalRightRail } from "./portal/PortalRightRail"
import type { PortalReservation } from "@/features/tenantPortal/services/tenantPortalService"
import "./portal/portal.css"

type Props = { themeStyle?: CSSProperties; tenantName?: string; nextReservation?: PortalReservation; reservationsHref?: string; subdomain: string; locale: string; onUnavailable: () => void; scopedAssets?: readonly PortalRentalAsset[]; scoped?: boolean; initialDate?: string; horizonMaxDate?: string | null; onBooked?: () => void }
type Period = "all" | "morning" | "afternoon" | "night"
type SelectedWindow = { rentalAssetId: string; assetId: string; unitId: string; startTime: string; endTime: string; slotId: string | null; quantity: number; amount: number }
const periodMatches = (start: string, period: Period) => { const hour = Number(start.slice(0, 2)); return period === "all" || (period === "morning" && hour < 12) || (period === "afternoon" && hour >= 12 && hour < 18) || (period === "night" && hour >= 18) }
const quoteIsCurrent = (expiresAt: string | undefined) => Boolean(expiresAt && Date.parse(expiresAt) > Date.now())
const EMPTY_ASSETS: readonly PortalRentalAsset[] = []
const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 768

export function BookingMapExperience({ subdomain, locale, onUnavailable, scopedAssets = EMPTY_ASSETS, scoped = false, initialDate, horizonMaxDate, onBooked, themeStyle, tenantName, nextReservation, reservationsHref = "#minhas-reservas" }: Props) {
  const { t } = useTranslation()
  const timeZoneId = useTenantTimeZone()
  const [list, setList] = useState<Awaited<ReturnType<typeof fetchPublicBookingMaps>> | null>(null)
  const [map, setMap] = useState<PublicMap | null>(null)
  const [availability, setAvailability] = useState<DailyAvailability | null>(null)
  const [date, setDate] = useState(initialDate ?? tenantTodayIsoDate(timeZoneId))
  const [period, setPeriod] = useState<Period>("all")
  const [view, setView] = useState<"Map" | "List">(() => isMobileViewport() ? "List" : "Map")
  const [showPast, setShowPast] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedWindow, setSelectedWindow] = useState<SelectedWindow | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [requoteLoading, setRequoteLoading] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const unavailableRef = useRef(onUnavailable)

  useEffect(() => { unavailableRef.current = onUnavailable }, [onUnavailable])
  useEffect(() => { if (initialDate) setDate(initialDate) }, [initialDate])
  useEffect(() => { let cancelled = false; setLoading(true); void fetchPublicBookingMaps(subdomain).then(async (result) => { if (cancelled) return; setList(result); setView(isMobileViewport() ? "List" : result.settings.defaultView); const id = result.defaultLayoutId ?? result.maps[0]?.id; if (!id) return; const composition = await fetchPublicBookingMap(subdomain, id); if (!cancelled) setMap(composition) }).catch(() => { if (!cancelled) setMap(null) }).finally(() => { if (!cancelled) setLoading(false) }); return () => { cancelled = true } }, [subdomain])
  const scopedIds = useMemo(() => scopedAssets.map((asset) => asset.id), [scopedAssets])
  const mapItems = useMemo(() => (scoped ? (map?.items.filter((item) => scopedIds.includes(item.rentalAssetId)) ?? []) : (map?.items ?? [])), [map, scoped, scopedIds])
  const requestedIds = useMemo(() => [...new Set([...(mapItems.map((item) => item.rentalAssetId)), ...scopedIds])], [mapItems, scopedIds])
  useEffect(() => { if (!map || requestedIds.length === 0) return; let cancelled = false; setAvailabilityLoading(true); setSelectedWindow(null); setSelectedId(null); void fetchDailyAvailability(subdomain, date, requestedIds).then((result) => { if (!cancelled) setAvailability(result) }).catch(() => { if (!cancelled) setAvailability(null) }).finally(() => { if (!cancelled) setAvailabilityLoading(false) }); return () => { cancelled = true } }, [date, map, requestedIds, subdomain])
  useEffect(() => { if (!loading && (!map || !list)) unavailableRef.current() }, [list, loading, map])
  const resources = useMemo(() => availability?.resources ?? [], [availability])
  const resourceById = useMemo(() => new Map(resources.map((resource) => [resource.rentalAssetId, resource])), [resources])
  const selectedResource = selectedId ? resourceById.get(selectedId) : null
  const selectedResourceType = selectedResource?.type
  const selectedWindowAssetId = selectedWindow?.assetId
  const selectedWindowStartTime = selectedWindow?.startTime
  const selectedWindowEndTime = selectedWindow?.endTime
  const selectedAsset = selectedId ? scopedAssets.find((asset) => asset.id === selectedId) : undefined
  const queue = useReservationQueue({ rentalAssetId: selectedId, enabled: isLocationQueueEnabled(selectedAsset) || (selectedResource?.queueEnabled === true && selectedResource.type === "Location") })
  const summary = (id: string, selectedPeriod = period) => { const windows = (resourceById.get(id)?.windows ?? []).filter((window) => periodMatches(window.startTime, selectedPeriod)); const free = windows.filter((window) => window.state === "Available" && window.totalAmount !== null); const min = free.reduce<number | null>((current, window) => current === null || (window.totalAmount ?? Infinity) < current ? window.totalAmount : current, null); return { windows, free, min } }
  const slots = selectedResource ? summary(selectedResource.rentalAssetId).windows : []
  const visibleSlots = slots.filter((window) => showPast || window.state !== "Past")
  const pastSlots = slots.filter((window) => window.state === "Past")
  const visualById = useMemo(() => new Map((map?.visualRevisions ?? []).map((revision) => [revision.id, revision])), [map])
  const placedIds = useMemo(() => new Set(mapItems.map((item) => item.rentalAssetId)), [mapItems])
  const listResourceIds = useMemo(() => [...new Set([...placedIds, ...scopedIds])], [placedIds, scopedIds])
  const displayedResourceIds = (view === "Map" ? mapItems.map((item) => item.rentalAssetId) : listResourceIds).filter((id) => resourceById.has(id))
  useEffect(() => { if (!selectedWindowAssetId || !selectedWindowStartTime || !selectedWindowEndTime || selectedResourceType !== "Good") { setRequoteLoading(false); return }; let cancelled = false; setRequoteLoading(true); void checkPortalAvailability(subdomain, { assetId: selectedWindowAssetId, date, startTime: selectedWindowStartTime.slice(0, 5), endTime: bookingEndClock(selectedWindowEndTime), quantity }).then((result) => { if (!cancelled) setSelectedWindow((current) => current ? { ...current, quantity, amount: result.isAvailable ? (result.estimatedTotalAmount ?? -1) : -1 } : null) }).catch(() => { if (!cancelled) setSelectedWindow(null) }).finally(() => { if (!cancelled) setRequoteLoading(false) }); return () => { cancelled = true } }, [date, quantity, selectedResourceType, selectedWindowAssetId, selectedWindowEndTime, selectedWindowStartTime, subdomain])
  useEffect(() => { const expiresAt = availability?.quoteExpiresAt; if (!expiresAt) return; const delay = Math.max(0, Date.parse(expiresAt) - Date.now()); const timer = window.setTimeout(() => setNow(Date.now()), delay); return () => window.clearTimeout(timer) }, [availability?.quoteExpiresAt])
  useBookingIdleTimeout({ selectionKey: selectedWindow ? `${date}:${selectedWindow.rentalAssetId}:${selectedWindow.startTime}` : null, paused: submitting, onExpire: () => { setSelectedWindow(null); setSelectedId(null) } })
  async function continueBooking() { if (!selectedWindow || submitting || availabilityLoading || requoteLoading || !quoteIsCurrent(availability?.quoteExpiresAt) || !queue.canReserve || selectedWindow.amount < 0) return; const booking = selectedWindow; setSubmitting(true); try { if (booking.slotId) await bookPortalSlot({ slotId: booking.slotId, unitId: booking.unitId, quantity: booking.quantity, expectedTotalAmount: booking.amount }); else await createPortalReservation({ unitId: booking.unitId, date, startTime: booking.startTime.slice(0, 5), endTime: bookingEndClock(booking.endTime), items: [{ assetId: booking.assetId, quantity: booking.quantity }], expectedTotalAmount: booking.amount }); toast.success(t("bookingMap.success")); onBooked?.(); setSelectedWindow(null); setSelectedId(null) } catch (error) { const reconciled = await listMyPortalReservations().then((reservations) => reservations.some((reservation) => { const start = reservationCivilStart(reservation.startDateTime, timeZoneId); return start?.date === date && start.time === booking.startTime && reservation.items.some((item) => item.assetId === booking.assetId && item.quantity === booking.quantity) })).catch(() => false); if (reconciled) { toast.message(t("tenantPortal.agenda.alreadyReserved")); onBooked?.(); setSelectedWindow(null); setSelectedId(null) } else if (!queue.applyBookingError(error)) toast.error(error instanceof Error ? error.message : t("bookingMap.error")) } finally { setSubmitting(false) } }
  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground" aria-busy="true">
        {t("bookingMap.loading")}
      </div>
    )
  }
  if (!map || !list) return null
  const periodFreeCounts = (['all', 'morning', 'afternoon', 'night'] as const).reduce<Record<Period, number>>((counts, value) => { counts[value] = resources.reduce((total, resource) => total + summary(resource.rentalAssetId, value).free.length, 0); return counts }, { all: 0, morning: 0, afternoon: 0, night: 0 })
  const tileDetails = (resource: DailyAvailability["resources"][number], result: ReturnType<typeof summary>) => {
    const window = result.free[0] ?? result.windows.find((candidate) => candidate.state !== "Past")
    const details: string[] = []
    const unitPrice = window ? unitPriceForWindow(window) : null
    if (unitPrice) {
      details.push(formatUnitPriceText(unitPrice.amount, unitPrice.unit, availability?.currency ?? "BRL", locale, t, "bookingMap.prices"))
    }
    if (resource.totalQuantity > 1 && window) details.push(t("bookingMap.unitsLeft", { left: window.availableQuantity, total: resource.totalQuantity }))
    return details.join(" · ")
  }
  const boardItems = mapItems.map((item) => { const result = summary(item.rentalAssetId); const revision = item.visualTemplateRevisionId ? visualById.get(item.visualTemplateRevisionId) : undefined; const resource = resourceById.get(item.rentalAssetId); const details = resource ? tileDetails(resource, result) : ""; return { key: item.id, rentalAssetId: item.rentalAssetId, label: item.assetName, footer: details ? `${item.assetName} · ${details}` : null, xPercent: item.xPercent, yPercent: item.yPercent, widthPercent: item.widthPercent, heightPercent: item.heightPercent, zIndex: item.zIndex, selected: selectedId === item.rentalAssetId, available: result.free.length > 0, disabled: availabilityLoading, artUrl: revision ? visualArtUrl(revision.id, revision.artSha256) : null, icon: revision ? VISUAL_ICON_MAP[revision.defaultIcon] ?? null : null, accentColor: revision?.defaultColor ?? null } })
  const canContinue = selectedWindow !== null && selectedWindow.amount >= 0 && !submitting && !availabilityLoading && !requoteLoading && Boolean(availability?.quoteExpiresAt && Date.parse(availability.quoteExpiresAt) > now) && queue.canReserve
  const cutoffHours = selectedAsset?.effectiveCancelCutoffHours ?? null
  const showCutoffWarning = selectedWindow !== null && isWithinCancelCutoff(cutoffHours, date, selectedWindow.startTime, timeZoneId)
  return (
    <div className="portal-booking-grid">
      <section className="portal-booking-column">
      <PortalBookingHeader tenantName={tenantName} />
      <DateStrip value={date} today={tenantTodayIsoDate(timeZoneId)} locale={locale} max={horizonMaxDate} disabled={availabilityLoading} onChange={setDate} />
      <div className="portal-tools">
        <SegmentedControl label={t("bookingMap.periods")} value={period} onChange={setPeriod}
          options={(["all", "morning", "afternoon", "night"] as const).map((value) => ({ value, label: t(`bookingMap.${value}`), count: availabilityLoading ? undefined : periodFreeCounts[value] }))} />
        <SegmentedControl label={t("tenantPortal.redesign.view")} value={view} onChange={setView}
          options={[
            { value: "Map", label: t("bookingMap.map"), icon: <MapIcon className="size-4" strokeWidth={1.75} aria-hidden="true" /> },
            { value: "List", label: t("bookingMap.list"), icon: <List className="size-4" strokeWidth={1.75} aria-hidden="true" /> },
          ]} />
      </div>
      {!availabilityLoading && availability && displayedResourceIds.length === 0 ? <PortalBookingEmptyState /> : null}
      {availabilityLoading ? <p className="mb-3 text-sm text-muted-foreground" role="status">{t("bookingMap.loading")}</p> : null}
      {!availabilityLoading && !availability ? <p className="mb-3 text-sm text-muted-foreground" role="status">{t("tenantPortal.agenda.slotsError")}</p> : null}

      {list.maps.length > 1 ? (
        <select
          aria-label={t("bookingMap.area")}
          value={map.id}
          onChange={(event) => void fetchPublicBookingMap(subdomain, event.target.value).then(setMap)}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          {list.maps.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      ) : null}

      <div id="portal-booking-spaces" role="group" aria-label={t("tenantPortal.agenda.chooseSpaceFirst")} tabIndex={-1}>
      {view === "Map" ? <div className="portal-canvas">
        <LayoutCanvasBoard mode="pick" aspectRatio={map.aspectRatio} canvasWidthPercent={100} items={boardItems}
          onSelect={(id) => { setSelectedId(id); setSelectedWindow(null); setQuantity(1) }} />
      </div> : null}
      <ul className={view === "Map" ? "portal-resource-grid" : "portal-list"} aria-busy={availabilityLoading}>
        {displayedResourceIds.map((id) => {
          const resource = resourceById.get(id)
          const item = boardItems.find((entry) => entry.rentalAssetId === id)
          if (!resource) return null
          const result = summary(id)
          const name = item?.label ?? resource.name
          const status = result.free.length === 0 ? "full" : result.free.length <= 2 ? "few" : "free"
          const Icon = item?.icon
          return (
            <li key={id} className="portal-resource" data-selected={selectedId === id}>
              <div className="portal-resource-heading">
                <button type="button" ref={selectedId === id ? triggerRef : undefined} className="min-w-0 flex-1 text-left"
                  aria-label={view === "Map" ? t("tenantPortal.redesign.resourceTimes", { name }) : name} title={name} aria-pressed={selectedId === id} disabled={availabilityLoading}
                  onClick={() => { setSelectedId(id); setSelectedWindow(null); setQuantity(1) }}>
                  <strong className="portal-resource-title block">{name}</strong>
                  {tileDetails(resource, result) ? <span className="block text-xs text-muted-foreground">{name} · {tileDetails(resource, result)}</span> : null}
                </button>
                {!availabilityLoading ? <span className={`portal-status-chip portal-status-${status}`}>{t(`tenantPortal.redesign.status_${status}`)}</span> : null}
              </div>
              {view === "Map" ? <div className="portal-resource-art flex items-center justify-center overflow-hidden" aria-hidden="true">
                {item?.artUrl ? <img src={item.artUrl} alt="" className="size-full object-contain" /> : Icon ? <Icon className="size-8 text-primary" strokeWidth={1.75} /> : null}
              </div> : null}
              <div className="portal-slots">
                {result.windows.filter((window) => window.state !== "Past").map((window) => {
                  const available = window.state === "Available" && window.totalAmount !== null
                  return <button key={`${window.startTime}-${window.endTime}`} type="button" className="portal-slot"
                    disabled={!available || availabilityLoading}
                    aria-label={`${name} · ${window.startTime.slice(0, 5)}–${displayEndClock(window.endTime)} · ${t(`bookingMap.state.${window.state}`)}`}
                    aria-pressed={selectedId === id && selectedWindow?.startTime === window.startTime}
                    onClick={() => {
                      setSelectedId(id)
                      setQuantity(1)
                      setSelectedWindow({ rentalAssetId: resource.rentalAssetId, assetId: resource.assetId, unitId: resource.unitId, startTime: window.startTime, endTime: window.endTime, slotId: window.slotId, quantity: 1, amount: resource.type === "Good" ? -1 : window.totalAmount ?? 0 })
                    }}>{window.startTime.slice(0, 5)}</button>
                })}
              </div>
              {result.windows.filter((window) => window.state !== "Past").length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t("bookingMap.noAvailability")}</p> : null}
            </li>
          )
        })}
      </ul>
      </div>
      </section>
      <PortalRightRail nextReservation={nextReservation} reservationsHref={reservationsHref} />

      <Sheet open={selectedResource !== null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setSelectedWindow(null); window.setTimeout(() => triggerRef.current?.focus(), 0) } }}>
        <SheetContent style={themeStyle} side="bottom" showCloseButton={false} className="portal-sheet flex max-h-[85dvh] w-full flex-col rounded-t-2xl sm:inset-y-0 sm:right-0 sm:h-full sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted-foreground/35 sm:hidden" aria-hidden="true" />
          <SheetClose aria-label={t("bookingMap.close")} className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground">
            <XIcon className="size-4" strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </SheetClose>
          <SheetHeader>
            <SheetTitle>{selectedResource?.name}</SheetTitle>
          </SheetHeader>

          {queue.view.kind !== "hidden" ? (
            <div className="space-y-2 border-y border-border py-3">
              <p className="text-sm text-foreground">{queue.explanation}</p>
              {queue.view.kind === "join" ? (
                <Button disabled={queue.joining} onClick={() => void queue.join()}>
                  {t("tenantPortal.agenda.queue.join")}
                </Button>
              ) : null}
              {queue.view.kind === "waiting" ? <p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.queue.position", { position: queue.view.position })}</p> : null}
              {queue.view.kind === "active" ? <p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.queue.countdown", { time: queue.view.countdown })}</p> : null}
              {queue.view.kind === "closed" ? (
                <p className="text-sm text-muted-foreground">{t("tenantPortal.agenda.queue.closed", { waitingRoom: queue.view.waitingRoomTime, opensAt: queue.view.opensTime })}</p>
              ) : null}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-4 pb-8">
            {visibleSlots.map((window) => {
              const available = window.state === "Available" && window.totalAmount !== null
              return (
                <button
                  type="button"
                  disabled={!available || availabilityLoading}
                  key={`${window.startTime}-${window.endTime}`}
                  className="portal-slot w-full text-left disabled:line-through"
                  aria-pressed={selectedWindow?.startTime === window.startTime}
                  onClick={() => available && setSelectedWindow({ rentalAssetId: selectedResource?.rentalAssetId ?? "", assetId: selectedResource?.assetId ?? "", unitId: selectedResource?.unitId ?? "", startTime: window.startTime, endTime: window.endTime, slotId: window.slotId, quantity: 1, amount: selectedResource?.type === "Good" ? -1 : window.totalAmount ?? 0 })}
                >
                  {window.startTime.slice(0, 5)}–{displayEndClock(window.endTime)} · {available ? formatLocaleCurrency(window.totalAmount ?? 0, "BRL", locale) : t(`bookingMap.state.${window.state}`)}
                </button>
              )
            })}
          </div>

          {pastSlots.length > 0 ? (
            <Button variant="ghost" size="sm" className="min-h-11 self-start" onClick={() => setShowPast((current) => !current)}>
              {showPast ? t("bookingMap.hidePast") : t("bookingMap.showPast", { count: pastSlots.length })}
            </Button>
          ) : null}

          {selectedResource?.type === "Good" && selectedWindow ? (
            <label className="block text-sm text-foreground">
              {t("bookingMap.quantity")}
              <Input
                aria-label={t("bookingMap.quantity")}
                type="number"
                min={1}
                max={Math.max(1, slots.find((slot) => slot.startTime === selectedWindow.startTime)?.availableQuantity ?? 1)}
                value={quantity}
                className="mt-1 h-11"
                onChange={(event) => { const nextQuantity = Math.max(1, Number(event.target.value) || 1); setSelectedWindow((current) => current ? { ...current, quantity: nextQuantity, amount: -1 } : null); setQuantity(nextQuantity) }}
              />
            </label>
          ) : null}

          {showCutoffWarning ? (
            <p role="alert" className="rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {t("tenantPortal.agenda.cancelCutoffBookingWarning", { count: cutoffHours ?? 0 })}
            </p>
          ) : null}

          <div className="portal-summary shrink-0">
            {selectedWindow ? <div className="min-w-0 basis-full"><p className="truncate text-sm font-semibold" title={selectedResource?.name}>{selectedResource?.name}</p><p className="text-xs text-muted-foreground">{date} · {selectedWindow.startTime.slice(0, 5)}–{displayEndClock(selectedWindow.endTime)}</p></div> : null}
            <Button className="w-full" disabled={!canContinue} onClick={() => void continueBooking()}>
              {selectedWindow ? `${t("bookingMap.continue")} · ${formatLocaleCurrency(selectedWindow.amount, "BRL", locale)}` : t("bookingMap.chooseSlot")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
