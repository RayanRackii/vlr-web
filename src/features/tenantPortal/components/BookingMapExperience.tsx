import { bookingEndClock, displayEndClock } from "@/lib/tenantTimeZone"
/* eslint-disable react-hooks/set-state-in-effect */
import { CircleDotIcon, LayoutTemplateIcon, XIcon, type LucideIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LayoutCanvasBoard } from "@/features/rentals/components/layout/LayoutCanvasBoard"
import { fetchDailyAvailability, fetchPublicBookingMap, fetchPublicBookingMaps, visualArtUrl, type DailyAvailability, type PublicMap } from "@/features/rentals/services/resourceVisualService"
import { useReservationQueue } from "@/features/tenantPortal/hooks/useReservationQueue"
import { useBookingIdleTimeout } from "@/features/tenantPortal/hooks/useBookingIdleTimeout"
import { reservationCivilStart } from "@/features/tenantPortal/lib/agendaReservationQuery"
import { bookPortalSlot, checkPortalAvailability, createPortalReservation, isLocationQueueEnabled, listMyPortalReservations, type PortalRentalAsset } from "@/features/tenantPortal/services/tenantPortalService"
import { ICON_STROKE_WIDTH } from "@/lib/icon"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import { formatUnitPriceText } from "@/lib/pricingUnitText"

type Props = { subdomain: string; locale: string; onUnavailable: () => void; scopedAssets?: readonly PortalRentalAsset[]; scoped?: boolean; initialDate?: string; onBooked?: () => void }
type Period = "all" | "morning" | "afternoon" | "night"
type SelectedWindow = { rentalAssetId: string; assetId: string; unitId: string; startTime: string; endTime: string; slotId: string | null; quantity: number; amount: number }
const plusDays = (date: string, offset: number) => { const result = new Date(`${date}T12:00:00`); result.setDate(result.getDate() + offset); return result.toISOString().slice(0, 10) }
const periodMatches = (start: string, period: Period) => { const hour = Number(start.slice(0, 2)); return period === "all" || (period === "morning" && hour < 12) || (period === "afternoon" && hour >= 12 && hour < 18) || (period === "night" && hour >= 18) }
const quoteIsCurrent = (expiresAt: string | undefined) => Boolean(expiresAt && Date.parse(expiresAt) > Date.now())
const EMPTY_ASSETS: readonly PortalRentalAsset[] = []
const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 768
const VISUAL_ICON_MAP: Record<string, LucideIcon> = {
  "circle-dot": CircleDotIcon,
  "layout-template": LayoutTemplateIcon,
}

export function BookingMapExperience({ subdomain, locale, onUnavailable, scopedAssets = EMPTY_ASSETS, scoped = false, initialDate, onBooked }: Props) {
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
    if (window?.totalAmount !== null && window?.totalAmount !== undefined) {
      const hours = (Date.parse(`1970-01-01T${window.endTime}`) - Date.parse(`1970-01-01T${window.startTime}`)) / 3_600_000
      if (hours > 0) {
        const unit = window.pricingUnit ?? "Hour"
        const divisor = unit === "Hour" ? hours : unit === "Day" ? Math.max(1, Math.ceil(hours / 24)) : 1
        details.push(formatUnitPriceText(window.totalAmount / divisor, unit, availability?.currency ?? "BRL", locale, t, "bookingMap.prices"))
      }
    }
    if (resource.totalQuantity > 1 && window) details.push(t("bookingMap.unitsLeft", { left: window.availableQuantity, total: resource.totalQuantity }))
    return details.join(" · ")
  }
  const boardItems = mapItems.map((item) => { const result = summary(item.rentalAssetId); const revision = item.visualTemplateRevisionId ? visualById.get(item.visualTemplateRevisionId) : undefined; const resource = resourceById.get(item.rentalAssetId); const details = resource ? tileDetails(resource, result) : ""; return { key: item.id, rentalAssetId: item.rentalAssetId, label: item.assetName, footer: details ? `${item.assetName} · ${details}` : null, xPercent: item.xPercent, yPercent: item.yPercent, widthPercent: item.widthPercent, heightPercent: item.heightPercent, zIndex: item.zIndex, selected: selectedId === item.rentalAssetId, available: result.free.length > 0, disabled: availabilityLoading, artUrl: revision ? visualArtUrl(revision.id, revision.artSha256) : null, icon: revision ? VISUAL_ICON_MAP[revision.defaultIcon] ?? null : null } })
  const canContinue = selectedWindow !== null && selectedWindow.amount >= 0 && !submitting && !availabilityLoading && !requoteLoading && Boolean(availability?.quoteExpiresAt && Date.parse(availability.quoteExpiresAt) > now) && queue.canReserve
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{t("bookingMap.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("bookingMap.help")}</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label={t("bookingMap.dateStrip")}>
        <Button className="min-h-11" disabled={availabilityLoading} size="sm" variant={date === tenantTodayIsoDate(timeZoneId) ? "default" : "outline"} onClick={() => setDate(tenantTodayIsoDate(timeZoneId))}>
          {t("bookingMap.today")}
        </Button>
        {Array.from({ length: 7 }, (_, offset) => {
          const value = plusDays(tenantTodayIsoDate(timeZoneId), offset)
          return (
            <Button key={value} className="min-h-11" disabled={availabilityLoading} size="sm" variant={value === date ? "default" : "outline"} onClick={() => setDate(value)}>
              {new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`))}
            </Button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("bookingMap.periods")}>
        {(["all", "morning", "afternoon", "night"] as const).map((value) => (
          <Button key={value} size="sm" variant={period === value ? "default" : "outline"} aria-pressed={period === value} onClick={() => setPeriod(value)}>
            {t(`bookingMap.${value}`, { count: periodFreeCounts[value] })}
          </Button>
        ))}
        <span className="flex-1" />
        <Button size="sm" variant={view === "Map" ? "default" : "outline"} onClick={() => setView("Map")}>
          {t("bookingMap.map")}
        </Button>
        <Button size="sm" variant={view === "List" ? "default" : "outline"} onClick={() => setView("List")}>
          {t("bookingMap.list")}
        </Button>
      </div>

      {period !== "all" && periodFreeCounts[period] === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">{t("bookingMap.emptyPeriod")}</p>
      ) : null}

      {list.maps.length > 1 ? (
        <select
          aria-label={t("bookingMap.area")}
          value={map.id}
          onChange={(event) => void fetchPublicBookingMap(subdomain, event.target.value).then(setMap)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
        >
          {list.maps.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      ) : null}

      {view === "Map" ? (
        <LayoutCanvasBoard mode="pick" aspectRatio={map.aspectRatio} canvasWidthPercent={100} items={boardItems} onSelect={(id) => { setSelectedId(id); setSelectedWindow(null); setQuantity(1) }} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {listResourceIds.map((id) => {
            const resource = resourceById.get(id)
            const item = mapItems.find((entry) => entry.rentalAssetId === id)
            if (!resource) return null
            const result = summary(id)
            return (
              <li key={id}>
                <button
                  ref={selectedId === id ? triggerRef : undefined}
                  type="button"
                  className="min-h-11 w-full rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors duration-150 ease-out hover:bg-muted/40 aria-pressed:border-primary aria-pressed:bg-primary/5 disabled:opacity-50"
                  aria-pressed={selectedId === id}
                  disabled={availabilityLoading}
                  onClick={() => { setSelectedId(id); setSelectedWindow(null); setQuantity(1) }}
                >
                  <strong className="text-sm font-semibold text-foreground">{item?.assetName ?? resource.name}</strong>
                  {tileDetails(resource, result) ? <span className="mt-1 block text-xs text-muted-foreground">{tileDetails(resource, result)}</span> : null}
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {result.free.slice(0, 3).map((window) => (
                      <Badge key={`${window.startTime}-${window.endTime}`} variant="secondary">
                        {window.startTime.slice(0, 5)}
                      </Badge>
                    ))}
                  </span>
                  {result.free.length === 0 ? (
                    <span className="mt-2 block text-sm text-muted-foreground">{t("bookingMap.noAvailability")}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={selectedResource !== null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setSelectedWindow(null); window.setTimeout(() => triggerRef.current?.focus(), 0) } }}>
        <SheetContent side="bottom" showCloseButton={false} className="flex max-h-[85dvh] w-full flex-col rounded-t-2xl sm:inset-y-0 sm:right-0 sm:h-full sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0">
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

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-4">
            {visibleSlots.map((window) => {
              const available = window.state === "Available" && window.totalAmount !== null
              return (
                <button
                  type="button"
                  disabled={!available || availabilityLoading}
                  key={`${window.startTime}-${window.endTime}`}
                  className="min-h-11 w-full rounded-xl border border-border p-3 text-left text-sm transition-colors duration-150 ease-out hover:bg-muted/40 aria-pressed:border-primary aria-pressed:bg-primary/5 disabled:opacity-50"
                  aria-pressed={selectedWindow?.startTime === window.startTime}
                  onClick={() => available && setSelectedWindow({ rentalAssetId: selectedResource?.rentalAssetId ?? "", assetId: selectedResource?.assetId ?? "", unitId: selectedResource?.unitId ?? "", startTime: window.startTime, endTime: window.endTime, slotId: window.slotId, quantity: 1, amount: selectedResource?.type === "Good" ? -1 : window.totalAmount ?? 0 })}
                >
                  {window.startTime.slice(0, 5)}–{displayEndClock(window.endTime)} · {available ? formatLocaleCurrency(window.totalAmount ?? 0, "BRL", locale) : t(`bookingMap.state.${window.state}`)}
                </button>
              )
            })}
          </div>

          {pastSlots.length > 0 ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowPast((current) => !current)}>
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
                className="mt-1"
                onChange={(event) => { const nextQuantity = Math.max(1, Number(event.target.value) || 1); setSelectedWindow((current) => current ? { ...current, quantity: nextQuantity, amount: -1 } : null); setQuantity(nextQuantity) }}
              />
            </label>
          ) : null}

          <div className="sticky bottom-0 border-t border-border bg-background py-3">
            <Button className="w-full" disabled={!canContinue} onClick={() => void continueBooking()}>
              {selectedWindow ? `${t("bookingMap.continue")} · ${formatLocaleCurrency(selectedWindow.amount, "BRL", locale)}` : t("bookingMap.chooseSlot")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </main>
  )
}
