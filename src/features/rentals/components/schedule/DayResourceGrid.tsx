import { Ban, CalendarCheck2, CircleCheck } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  durationValues,
  formatMinutesAsTime,
  gcd,
  timeToMinutes,
  type ScheduleGridOccupancy,
} from "@/features/rentals/components/schedule/scheduleGridModel"
import type { AdminDaySlot, AdminRentalAsset } from "@/features/rentals/services/scheduleService"
import { cn } from "@/lib/utils"

export type { ScheduleGridOccupancy }

const TIME_COLUMN_WIDTH = 76
const MIN_RESOURCE_COLUMN_WIDTH = 160
const HEADER_HEIGHT = 48
const ROW_HEIGHT = 54

const STATUS_ICON: Record<ScheduleGridOccupancy["status"], typeof CircleCheck> = {
  available: CircleCheck,
  booked: CalendarCheck2,
  unavailable: Ban,
}

const STATUS_TEXT_CLASS: Record<ScheduleGridOccupancy["status"], string> = {
  available: "text-success",
  booked: "text-info",
  unavailable: "text-muted-foreground",
}

export type ScheduleGridCellPayload = {
  rentalAssetId: string
  assetName: string
  startTime: string
  endTime: string
  occupancy: ScheduleGridOccupancy | null
}

export type DayResourceGridCellPayload = ScheduleGridCellPayload & {
  date: string
  slot: AdminDaySlot | null
}

type DayResourceGridProps = {
  assets: readonly AdminRentalAsset[]
  occupancies: readonly ScheduleGridOccupancy[]
  busyTargetKey: string | null
  readOnly: boolean
  /** Minutes since midnight on the tenant clock, only when the grid shows today. */
  nowMinutes?: number | null
  isStartClosed?: (startTime: string) => boolean
  onCellClick: (payload: ScheduleGridCellPayload) => void
}

export function DayResourceGrid({
  assets,
  occupancies,
  busyTargetKey,
  readOnly,
  nowMinutes = null,
  isStartClosed,
  onCellClick,
}: DayResourceGridProps) {
  const { t } = useTranslation()

  const axis = useMemo(() => {
    const starts = occupancies.map((item) => timeToMinutes(item.startTime))
    const ends = occupancies.map((item) => timeToMinutes(item.endTime))
    const assetStarts = assets
      .map((asset) => asset.openTime && timeToMinutes(asset.openTime))
      .filter((value): value is number => typeof value === "number")
    const assetEnds = assets
      .map((asset) => asset.closeTime && timeToMinutes(asset.closeTime))
      .filter((value): value is number => typeof value === "number")
    const durations = [
      ...occupancies.map(
        (item) => timeToMinutes(item.endTime) - timeToMinutes(item.startTime),
      ),
      ...assets.flatMap(durationValues),
    ].filter((value) => value > 0)
    const rawStep = durations.reduce((current, value) => gcd(current, value), 0)
    const step = Math.min(60, Math.max(15, rawStep || 60))
    const observedStarts = [...starts, ...assetStarts]
    const observedEnds = [...ends, ...assetEnds]
    const start =
      Math.floor(
        (observedStarts.length > 0 ? Math.min(...observedStarts) : 8 * 60) / step,
      ) * step
    const end =
      Math.ceil(
        (observedEnds.length > 0 ? Math.max(...observedEnds) : 22 * 60) / step,
      ) * step
    return {
      start,
      end,
      step,
      rows: Array.from(
        { length: Math.max(1, Math.ceil((end - start) / step)) },
        (_, index) => start + index * step,
      ),
    }
  }, [assets, occupancies])

  const occupanciesByAsset = useMemo(() => {
    const grouped = new Map<string, ScheduleGridOccupancy[]>()
    for (const item of occupancies) {
      const list = grouped.get(item.rentalAssetId) ?? []
      list.push(item)
      grouped.set(item.rentalAssetId, list)
    }
    return grouped
  }, [occupancies])

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
        {t("rentals.schedule.grid.noSelection")}
      </div>
    )
  }

  const columns = `${TIME_COLUMN_WIDTH}px repeat(${assets.length}, minmax(${MIN_RESOURCE_COLUMN_WIDTH}px, 1fr))`
  const showNowLine =
    typeof nowMinutes === "number" &&
    nowMinutes >= axis.start &&
    nowMinutes <= axis.end
  const nowLineTop =
    HEADER_HEIGHT +
    (((nowMinutes ?? 0) - axis.start) / axis.step) * ROW_HEIGHT

  return (
    <div className="space-y-2">
      <ScheduleGridLegend />
      <div className="max-h-[70vh] w-full overflow-auto rounded-xl border border-border bg-background shadow-sm">
        <div className="relative min-w-full">
          <div
            role="grid"
            aria-rowcount={axis.rows.length + 1}
            aria-colcount={assets.length + 1}
            className="grid min-w-full"
            style={{ gridTemplateColumns: columns }}
          >
            <div
              role="columnheader"
              className="sticky top-0 left-0 z-30 flex items-center border-b border-r border-border bg-background px-3 text-xs font-medium text-muted-foreground"
              style={{ height: HEADER_HEIGHT }}
            >
              {t("rentals.schedule.templates.start")}
            </div>
            {assets.map((asset) => (
              <div
                key={asset.id}
                role="columnheader"
                className="sticky top-0 z-20 flex items-center border-b border-r border-border bg-background px-3 text-sm font-medium"
                style={{ height: HEADER_HEIGHT }}
              >
                <span className="truncate">{asset.name}</span>
              </div>
            ))}

            {axis.rows.map((rowStart, rowIndex) => {
              const rowEnd = rowStart + axis.step
              return (
                <RowCells
                  key={rowStart}
                  assets={assets}
                  occupanciesByAsset={occupanciesByAsset}
                  rowStart={rowStart}
                  rowEnd={rowEnd}
                  rowIndex={rowIndex}
                  axisStart={axis.start}
                  axisStep={axis.step}
                  busyTargetKey={busyTargetKey}
                  readOnly={readOnly}
                  isStartClosed={isStartClosed}
                  onCellClick={onCellClick}
                />
              )
            })}
          </div>
          {showNowLine ? (
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 z-10 flex items-center"
              style={{ top: nowLineTop, left: TIME_COLUMN_WIDTH }}
            >
              <span className="size-1.5 shrink-0 -translate-x-1/2 rounded-full bg-primary" />
              <span className="h-px w-full bg-primary/70" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const LEGEND_STATUSES = ["available", "booked", "unavailable"] as const

function ScheduleGridLegend() {
  const { t } = useTranslation()
  return (
    <ul
      aria-label={t("rentals.schedule.grid.legendLabel")}
      className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
    >
      {LEGEND_STATUSES.map((status) => {
        const Icon = STATUS_ICON[status]
        return (
          <li key={status} className="flex items-center gap-1.5">
            <Icon className={cn("size-3.5", STATUS_TEXT_CLASS[status])} aria-hidden />
            <span>{t(`rentals.schedule.occurrence.status.${status}`)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function RowCells({
  assets,
  occupanciesByAsset,
  rowStart,
  rowEnd,
  rowIndex,
  axisStart,
  axisStep,
  busyTargetKey,
  readOnly,
  isStartClosed,
  onCellClick,
}: {
  assets: readonly AdminRentalAsset[]
  occupanciesByAsset: ReadonlyMap<string, ScheduleGridOccupancy[]>
  rowStart: number
  rowEnd: number
  rowIndex: number
  axisStart: number
  axisStep: number
  busyTargetKey: string | null
  readOnly: boolean
  isStartClosed?: (startTime: string) => boolean
  onCellClick: (payload: ScheduleGridCellPayload) => void
}) {
  const rowClosed = isStartClosed?.(formatMinutesAsTime(rowStart)) === true
  const { t } = useTranslation()

  return (
    <>
      <div
        role="rowheader"
        className="sticky left-0 z-10 flex items-start justify-end border-b border-r border-border bg-background px-2 pt-2 text-xs tabular-nums text-muted-foreground"
        style={{ height: ROW_HEIGHT }}
      >
        {formatMinutesAsTime(rowStart)}
      </div>
      {assets.map((asset) => {
        const assetItems = occupanciesByAsset.get(asset.id) ?? []
        const covering = assetItems.filter((item) => {
          const start = timeToMinutes(item.startTime)
          const end = timeToMinutes(item.endTime)
          return start < rowEnd && end > rowStart
        })
        const starting = covering.filter(
          (item) =>
            Math.floor((timeToMinutes(item.startTime) - axisStart) / axisStep) ===
            rowIndex,
        )
        const isCovered = covering.length > 0
        return (
          <div
            key={asset.id}
            role="gridcell"
            className="relative overflow-visible border-b border-r border-border/70 p-1"
            style={{ height: ROW_HEIGHT }}
          >
            {!isCovered ? (
              <button
                type="button"
                disabled={readOnly || rowClosed}
                aria-label={`${asset.name}, ${formatMinutesAsTime(rowStart)}–${formatMinutesAsTime(rowEnd)}`}
                className="h-full w-full rounded-md border border-dashed border-transparent text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                onClick={() =>
                  onCellClick({
                    rentalAssetId: asset.id,
                    assetName: asset.name,
                    startTime: formatMinutesAsTime(rowStart),
                    endTime: formatMinutesAsTime(rowEnd),
                    occupancy: null,
                  })
                }
              >
                <span className="sr-only">
                  {t("rentals.schedule.grid.empty")}
                </span>
              </button>
            ) : null}
            {starting.map((item, stackIndex) => {
              const itemStart = timeToMinutes(item.startTime)
              const overlapIndex =
                assetItems.filter(
                  (other) =>
                    other.id !== item.id &&
                    timeToMinutes(other.startTime) < itemStart &&
                    timeToMinutes(other.endTime) > itemStart,
                ).length + stackIndex
              const rows = Math.max(
                1,
                Math.ceil(
                  (timeToMinutes(item.endTime) - timeToMinutes(item.startTime)) /
                    axisStep,
                ),
              )
              // Only the seeded "open" kind with its untouched default label is
              // localized; a tenant-renamed kind keeps its configured name.
              const isSeedOpenKind =
                item.occupancyKindKey === "open" &&
                item.occupancyKindLabel === "Open"
              const kindLabel =
                isSeedOpenKind
                  ? t("rentals.schedule.occupancyKinds.open")
                  : item.occupancyKindLabel
              const itemLabel = item.label?.trim()
              const statusLabel = t(
                `rentals.schedule.occurrence.status.${item.status}`,
              )
              const StatusIcon = STATUS_ICON[item.status]
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={
                    readOnly ||
                    busyTargetKey === item.id ||
                    (isStartClosed?.(item.startTime) === true &&
                      item.status !== "booked")
                  }
                  aria-label={`${asset.name}, ${formatMinutesAsTime(timeToMinutes(item.startTime))}, ${statusLabel}, ${itemLabel ? `${itemLabel}, ` : ""}${t("rentals.schedule.occupancyKindLabel")}: ${kindLabel}`}
                  className={cn(
                    "absolute top-1 overflow-hidden rounded-md border px-2 py-1.5 text-left shadow-sm transition hover:brightness-95 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                    overlapIndex > 0 && "translate-x-2",
                  )}
                  style={{
                    left: 4,
                    right: 4 + overlapIndex * 8,
                    height: rows * ROW_HEIGHT - 8,
                    zIndex: 5 + overlapIndex,
                    borderColor: item.occupancyKindColorHex ?? "var(--border)",
                    backgroundColor: item.occupancyKindColorHex
                      ? `${item.occupancyKindColorHex}20`
                      : "var(--muted)",
                  }}
                  onClick={() =>
                    onCellClick({
                      rentalAssetId: asset.id,
                      assetName: asset.name,
                      startTime: item.startTime,
                      endTime: item.endTime,
                      occupancy: item,
                    })
                  }
                >
                  <span className="block truncate text-xs text-muted-foreground">
                    {itemLabel ? `${itemLabel} · ` : ""}
                    {t("rentals.schedule.occupancyKindLabel")}: {kindLabel}
                  </span>
                  <span
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold",
                      STATUS_TEXT_CLASS[item.status],
                    )}
                  >
                    <StatusIcon className="size-2.5" aria-hidden />
                    {statusLabel}
                  </span>
                  {item.badge === "dailyOverride" ? (
                    <span className="ml-1 inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {t("rentals.schedule.occurrence.source.dailyOverride")}
                    </span>
                  ) : null}
                  {item.badge === "inactive" ? (
                    <span className="ml-1 inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t("rentals.schedule.inactive")}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
