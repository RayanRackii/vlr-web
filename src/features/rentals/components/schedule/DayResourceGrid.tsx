import { useVirtualizer } from "@tanstack/react-virtual"
import { useMemo, useRef } from "react"
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
const RESOURCE_COLUMN_WIDTH = 220
const HEADER_HEIGHT = 48
const ROW_HEIGHT = 54

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
  onCellClick: (payload: ScheduleGridCellPayload) => void
}

export function DayResourceGrid({
  assets,
  occupancies,
  busyTargetKey,
  readOnly,
  onCellClick,
}: DayResourceGridProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const rowVirtualizer = useVirtualizer({
    count: axis.rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  })
  const columnVirtualizer = useVirtualizer({
    count: assets.length,
    horizontal: true,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RESOURCE_COLUMN_WIDTH,
    overscan: 2,
    paddingStart: TIME_COLUMN_WIDTH,
  })

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

  const totalWidth = columnVirtualizer.getTotalSize()
  const totalHeight = HEADER_HEIGHT + rowVirtualizer.getTotalSize()

  return (
    <div
      ref={scrollRef}
      role="grid"
      aria-rowcount={axis.rows.length + 1}
      aria-colcount={assets.length + 1}
      className="relative h-[min(68vh,760px)] min-h-[420px] overflow-auto rounded-xl border border-border bg-background shadow-sm"
    >
      <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
        <div
          role="row"
          className="sticky top-0 z-30 border-b border-border bg-background/95 shadow-sm backdrop-blur"
          style={{ width: totalWidth, height: HEADER_HEIGHT }}
        >
          <div
            role="columnheader"
            className="sticky left-0 z-40 flex h-full items-center border-r border-border bg-background px-3 text-xs font-medium text-muted-foreground"
            style={{ width: TIME_COLUMN_WIDTH }}
          >
            {t("rentals.schedule.templates.start")}
          </div>
          {columnVirtualizer.getVirtualItems().map((column) => {
            const asset = assets[column.index]
            return (
              <div
                key={asset.id}
                role="columnheader"
                className="absolute top-0 flex h-full items-center border-r border-border bg-background px-3 text-sm font-medium"
                style={{
                  left: column.start,
                  width: column.size,
                }}
              >
                <span className="truncate">{asset.name}</span>
              </div>
            )
          })}
        </div>

        {rowVirtualizer.getVirtualItems().map((row) => {
          const rowStart = axis.rows[row.index]
          const rowEnd = rowStart + axis.step
          return (
            <div
              key={row.key}
              role="row"
              className="absolute left-0 border-b border-border/70"
              style={{
                top: HEADER_HEIGHT + row.start,
                width: totalWidth,
                height: row.size,
              }}
            >
              <div
                role="rowheader"
                className="sticky left-0 z-20 flex h-full items-start justify-end border-r border-border bg-background px-2 pt-2 text-xs tabular-nums text-muted-foreground"
                style={{ width: TIME_COLUMN_WIDTH }}
              >
                {formatMinutesAsTime(rowStart)}
              </div>
              {columnVirtualizer.getVirtualItems().map((column) => {
                const asset = assets[column.index]
                const assetItems = occupanciesByAsset.get(asset.id) ?? []
                const covering = assetItems.filter((item) => {
                  const start = timeToMinutes(item.startTime)
                  const end = timeToMinutes(item.endTime)
                  return start < rowEnd && end > rowStart
                })
                const starting = covering.filter(
                  (item) =>
                    Math.floor(
                      (timeToMinutes(item.startTime) - axis.start) / axis.step,
                    ) === row.index,
                )
                const isCovered = covering.length > 0
                return (
                  <div
                    key={asset.id}
                    role="gridcell"
                    className="absolute top-0 h-full border-r border-border/70 p-1"
                    style={{ left: column.start, width: column.size }}
                  >
                    {!isCovered ? (
                      <button
                        type="button"
                        disabled={readOnly}
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
                          (timeToMinutes(item.endTime) -
                            timeToMinutes(item.startTime)) /
                            axis.step,
                        ),
                      )
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={readOnly || busyTargetKey === item.id}
                          aria-label={`${asset.name}, ${item.occupancyKindLabel}, ${t(`rentals.schedule.occurrence.status.${item.status}`)}`}
                          className={cn(
                            "absolute top-1 overflow-hidden rounded-md border px-2 py-1.5 text-left shadow-sm transition hover:brightness-95 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                            overlapIndex > 0 && "translate-x-2",
                          )}
                          style={{
                            left: 4,
                            right: 4 + overlapIndex * 8,
                            height: rows * ROW_HEIGHT - 8,
                            zIndex: 5 + overlapIndex,
                            borderColor:
                              item.occupancyKindColorHex ?? "var(--border)",
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
                          <span className="block truncate text-xs font-semibold">
                            {item.label || item.occupancyKindLabel}
                          </span>
                          <span className="mt-1 inline-flex rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                            {t(`rentals.schedule.occurrence.status.${item.status}`)}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
