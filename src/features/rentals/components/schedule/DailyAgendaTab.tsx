import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { LocaleDateInput } from "@/components/LocaleDateInput"
import { formatLocaleCivilDate } from "@/lib/localeFormat"
import { useNavigate } from "react-router-dom"

import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DayResourceGrid,
  type DayResourceGridCellPayload,
} from "@/features/rentals/components/schedule/DayResourceGrid"
import { RentableMultiSelect } from "@/features/rentals/components/schedule/RentableMultiSelect"
import { ScheduleDaySlotsSkeleton } from "@/features/rentals/components/schedule/ScheduleDaySlotsSkeleton"
import { ScheduleEmptyState } from "@/features/rentals/components/schedule/ScheduleEmptyState"
import { todayIsoDate } from "@/features/rentals/components/schedule/scheduleFormDefaults"
import { isPastTenantSlotStart } from "@/features/rentals/lib/offerableSlot"
import { tenantCivilDateTime, tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { cn } from "@/lib/utils"
import {
  occupancyFromDaySlot,
  occupancyIdFromSlot,
  resolveScheduleSurface,
  timeToMinutes,
} from "@/features/rentals/components/schedule/scheduleGridModel"
import type {
  AdminDaySchedule,
  AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"

export type ScheduleBusyAction =
  | "publish"
  | "seed"
  | "policy"
  | "template"
  | "templateDelete"
  | "templateToggle"
  | "kind"
  | "slotUpdate"
  | "slotUnavailable"
  | "slotRestore"
  | "weeklyRule"
  | null

type DailyAgendaTabProps = {
  assets: readonly AdminRentalAsset[]
  selectedRentalAssetIds: readonly string[]
  date: string
  day: AdminDaySchedule | null
  loading: boolean
  showSkeleton: boolean
  busy: boolean
  busyAction: ScheduleBusyAction
  busyTargetKey: string | null
  readOnly: boolean
  onSelectedRentalAssetIdsChange: (ids: string[]) => void
  onDateChange: (date: string) => void
  onPublish: () => void
  onSlotOrCellClick: (payload: DayResourceGridCellPayload) => void
  onGoWeeklySetup?: () => void
}

const MOBILE_QUERY = "(max-width: 639px)"

function matchesMobileQuery(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(MOBILE_QUERY).matches
}

/** Guarded against environments without matchMedia (jsdom in tests). */
function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(matchesMobileQuery)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }
    const mql = window.matchMedia(MOBILE_QUERY)
    function onChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches)
    }
    mql.addEventListener("change", onChange)
    return () => {
      mql.removeEventListener("change", onChange)
    }
  }, [])

  return isMobile
}

/** Re-render when a minute passes, or when the tab is focused again. */
function useTenantClock(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    function bump() {
      setNow(Date.now())
    }

    let intervalId = 0
    const delay = 60_000 - (Date.now() % 60_000)
    const timeoutId = window.setTimeout(() => {
      bump()
      intervalId = window.setInterval(bump, 60_000)
    }, delay)

    function onFocus() {
      bump()
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        bump()
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return now
}

function addDays(isoDate: string, amount: number): string {
  const date = new Date(`${isoDate}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function DailyAgendaTab({
  assets,
  selectedRentalAssetIds,
  date,
  day,
  loading,
  showSkeleton,
  busy,
  busyAction,
  busyTargetKey,
  readOnly,
  onSelectedRentalAssetIdsChange,
  onDateChange,
  onPublish,
  onSlotOrCellClick,
  onGoWeeklySetup,
}: DailyAgendaTabProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const timeZoneId = useTenantTimeZone()
  const clock = useTenantClock()
  const now = useMemo(() => new Date(clock), [clock])
  const isMobile = useIsMobileViewport()

  const selectedAssets = useMemo(
    () =>
      assets.filter((asset) => selectedRentalAssetIds.includes(asset.id)),
    [assets, selectedRentalAssetIds],
  )

  // Mobile shows one resource at a time; this selection is purely presentational
  // (which already-selected resource is in focus) and never touches
  // selectedRentalAssetIds, which stays the shared source of truth.
  const [mobileFocusAssetId, setMobileFocusAssetId] = useState<string | null>(null)
  const selectedAssetIdsKey = selectedAssets.map((asset) => asset.id).join(",")
  const [trackedAssetIdsKey, setTrackedAssetIdsKey] = useState<string | null>(null)
  if (selectedAssetIdsKey !== trackedAssetIdsKey) {
    setTrackedAssetIdsKey(selectedAssetIdsKey)
    setMobileFocusAssetId((current) =>
      current && selectedAssets.some((asset) => asset.id === current)
        ? current
        : (selectedAssets[0]?.id ?? null),
    )
  }

  const occupancies = useMemo(() => {
    const today = tenantTodayIsoDate(timeZoneId, now)
    return (day?.slots ?? []).map((slot) => {
      const occupancy = occupancyFromDaySlot(slot)
      if (
        date === today &&
        occupancy.status === "available" &&
        isPastTenantSlotStart(date, slot.startTime, timeZoneId, now)
      ) {
        return { ...occupancy, status: "unavailable" as const }
      }
      return occupancy
    })
  }, [date, day, now, timeZoneId])

  const nowMinutes = useMemo(() => {
    if (date !== tenantTodayIsoDate(timeZoneId, now)) {
      return null
    }
    return timeToMinutes(tenantCivilDateTime(now, timeZoneId).time)
  }, [date, now, timeZoneId])

  const freeCountByAssetId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const occupancy of occupancies) {
      if (occupancy.status !== "available") continue
      counts.set(occupancy.rentalAssetId, (counts.get(occupancy.rentalAssetId) ?? 0) + 1)
    }
    return counts
  }, [occupancies])

  const showResourceChips = isMobile && selectedAssets.length > 1
  const gridAssets =
    showResourceChips
      ? selectedAssets.filter((asset) => asset.id === mobileFocusAssetId)
      : selectedAssets
  const resolvedGridAssets = gridAssets.length > 0 ? gridAssets : selectedAssets.slice(0, 1)

  const hasSlotGrid = selectedAssets.some(
    (asset) => (asset.schedulePolicy ?? "SlotGrid") === "SlotGrid",
  )

  const surface = resolveScheduleSurface({
    loading,
    showSkeleton,
    assetCount: assets.length,
    selectedCount: selectedAssets.length,
  })

  if (surface === "page-skeleton") {
    return (
      <div role="status" aria-live="polite">
        <p className="sr-only">{t("common.loading")}</p>
        <ScheduleDaySlotsSkeleton />
      </div>
    )
  }

  if (surface === "no-assets") {
    return (
      <ScheduleEmptyState
        icon={CalendarDays}
        title={t("rentals.schedule.noAssets")}
        description={t("rentals.schedule.noAssetsDescription")}
        actionLabel={t("rentals.schedule.noAssetsAction")}
        onAction={() => {
          void navigate("/configuracoes/recursos")
        }}
      />
    )
  }

  const showInlineRefresh = loading && surface === "grid" && day !== null

  return (
    <div className="min-w-0 w-full space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex shrink-0 items-center divide-x divide-border rounded-lg border border-border">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-r-none"
            aria-label={t("rentals.schedule.toolbar.prev")}
            onClick={() => onDateChange(addDays(date, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-none"
            onClick={() => onDateChange(todayIsoDate(timeZoneId))}
          >
            {t("rentals.schedule.toolbar.today")}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="rounded-l-none"
            aria-label={t("rentals.schedule.toolbar.next")}
            onClick={() => onDateChange(addDays(date, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <LocaleDateInput
          value={date}
          locale={i18n.language}
          today={tenantTodayIsoDate(timeZoneId, now)}
          className="min-w-0 max-w-full"
          onChange={(value) => {
            if (value) onDateChange(value)
          }}
        />
        <Popover>
          <PopoverTrigger
            render={<Button type="button" variant="outline" size="sm" />}
          >
            <SlidersHorizontal aria-hidden />
            {t("rentals.schedule.toolbar.resources", {
              selected: selectedRentalAssetIds.length,
              total: assets.length,
            })}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-4">
            <RentableMultiSelect
              assets={assets}
              selectedIds={selectedRentalAssetIds}
              onChange={onSelectedRentalAssetIdsChange}
            />
          </PopoverContent>
        </Popover>
        {hasSlotGrid ? (
          <LoadingButton
            type="button"
            size="sm"
            className="ml-auto"
            loading={busyAction === "publish"}
            disabled={busy || readOnly}
            onClick={onPublish}
          >
            {t("rentals.schedule.publishDay")}
          </LoadingButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <span>{t("rentals.schedule.dayOnlyBanner", { date: formatLocaleCivilDate(date, i18n.language) })}</span>
        {onGoWeeklySetup ? (
          <Button type="button" variant="link" size="xs" onClick={onGoWeeklySetup}>
            {t("rentals.schedule.tabs.templates")}
          </Button>
        ) : null}
      </div>

      <section className="min-w-0">
        {showInlineRefresh ? (
          <p className="sr-only" role="status" aria-live="polite">
            {t("common.refreshing")}
          </p>
        ) : null}
        {surface === "no-selection" ? (
          <ScheduleEmptyState
            icon={CalendarDays}
            title={t("rentals.schedule.grid.noSelection")}
          />
        ) : surface === "grid-skeleton" ? (
          <div role="status" aria-busy="true" aria-live="polite" className="space-y-2">
            <span className="sr-only">{t("common.loading")}</span>
            <ScheduleDaySlotsSkeleton columns={Math.min(selectedAssets.length, 5)} />
          </div>
        ) : (
          <div className="space-y-3">
            {showResourceChips ? (
              <ResourceFocusChips
                assets={selectedAssets}
                activeAssetId={mobileFocusAssetId}
                freeCountByAssetId={freeCountByAssetId}
                onSelect={setMobileFocusAssetId}
              />
            ) : null}
            <DayResourceGrid
              assets={resolvedGridAssets}
              occupancies={occupancies}
              busyTargetKey={busyTargetKey}
              readOnly={readOnly}
              nowMinutes={nowMinutes}
              isStartClosed={(startTime) =>
                date === tenantTodayIsoDate(timeZoneId, now) &&
                isPastTenantSlotStart(date, startTime, timeZoneId, now)
              }
              onCellClick={(cell) => {
                const slot = cell.occupancy
                  ? (day?.slots.find(
                      (item) => occupancyIdFromSlot(item) === cell.occupancy?.id,
                    ) ?? null)
                  : null
                onSlotOrCellClick({
                  rentalAssetId: cell.rentalAssetId,
                  assetName: cell.assetName,
                  date,
                  startTime: cell.startTime,
                  endTime: cell.endTime,
                  occupancy: cell.occupancy,
                  slot,
                })
              }}
            />
          </div>
        )}
      </section>
    </div>
  )
}

function ResourceFocusChips({
  assets,
  activeAssetId,
  freeCountByAssetId,
  onSelect,
}: {
  assets: readonly AdminRentalAsset[]
  activeAssetId: string | null
  freeCountByAssetId: ReadonlyMap<string, number>
  onSelect: (assetId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t("rentals.schedule.rentables")}
      className="flex min-w-0 flex-wrap gap-2 pb-1"
    >
      {assets.map((asset) => {
        const isActive = asset.id === activeAssetId
        const free = freeCountByAssetId.get(asset.id) ?? 0
        return (
          <button
            key={asset.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(asset.id)}
            className={cn(
              "touch-target flex min-h-10 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-medium motion-safe:transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <span className="truncate max-w-40">{asset.name}</span>
            {free > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 tabular-nums text-[11px] font-semibold leading-none",
                  isActive ? "bg-primary-foreground/20" : "bg-success/10 text-success",
                )}
              >
                {t("rentals.schedule.occurrence.unitsFree", { count: free })}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
