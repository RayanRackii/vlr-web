import { useVirtualizer } from "@tanstack/react-virtual"
import { useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"

import type {
  AdminDaySlot,
  AdminRentalAsset,
} from "@/features/rentals/services/scheduleService"
import { cn } from "@/lib/utils"

const TIME_COLUMN_WIDTH = 76
const RESOURCE_COLUMN_WIDTH = 220
const HEADER_HEIGHT = 48
const ROW_HEIGHT = 54

export type DayResourceGridCellPayload = {
  rentalAssetId: string
  assetName: string
  date: string
  startTime: string
  endTime: string
  slot: AdminDaySlot | null
}

type DayResourceGridProps = {
  assets: readonly AdminRentalAsset[]
  slots: readonly AdminDaySlot[]
  date: string
  busyTargetKey: string | null
  readOnly: boolean
  onCellClick: (payload: DayResourceGridCellPayload) => void
}

function timeToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":")
  return Number(hours) * 60 + Number(minutes)
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60)
  const minutes = value % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function gcd(a: number, b: number): number {
  let left = Math.abs(a)
  let right = Math.abs(b)
  while (right) {
    ;[left, right] = [right, left % right]
  }
  return left
}

function durationValues(asset: AdminRentalAsset): number[] {
  return (asset.allowedDurationMinutes ?? "")
    .split(",")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
}

function statusKey(slot: AdminDaySlot): "available" | "booked" | "unavailable" {
  if (slot.status === "Booked" || slot.reservationId) {
    return "booked"
  }
  if (slot.status === "Cancelled" || !slot.isBookableByCustomer) {
    return "unavailable"
  }
  return "available"
}

export function DayResourceGrid({
  assets,
  slots,
  date,
  busyTargetKey,
  readOnly,
  onCellClick,
}: DayResourceGridProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)

  const axis = useMemo(() => {
    const starts = slots.map((slot) => timeToMinutes(slot.startTime))
    const ends = slots.map((slot) => timeToMinutes(slot.endTime))
    const assetStarts = assets
      .map((asset) => asset.openTime && timeToMinutes(asset.openTime))
      .filter((value): value is number => typeof value === "number")
    const assetEnds = assets
      .map((asset) => asset.closeTime && timeToMinutes(asset.closeTime))
      .filter((value): value is number => typeof value === "number")
    const durations = [
      ...slots.map(
        (slot) => timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime),
      ),
      ...assets.flatMap(durationValues),
    ].filter((value) => value > 0)
    const rawStep = durations.reduce((current, value) => gcd(current, value), 0)
    const step = Math.min(60, Math.max(15, rawStep || 60))
    const observedStarts = [...starts, ...assetStarts]
    const observedEnds = [...ends, ...assetEnds]
    const start = Math.floor(
      (observedStarts.length > 0 ? Math.min(...observedStarts) : 8 * 60) / step,
    ) * step
    const end = Math.ceil(
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
  }, [assets, slots])

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

  const slotsByAsset = useMemo(() => {
    const grouped = new Map<string, AdminDaySlot[]>()
    for (const slot of slots) {
      const list = grouped.get(slot.rentalAssetId) ?? []
      list.push(slot)
      grouped.set(slot.rentalAssetId, list)
    }
    return grouped
  }, [slots])

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
                {minutesToTime(rowStart)}
              </div>
              {columnVirtualizer.getVirtualItems().map((column) => {
                const asset = assets[column.index]
                const assetSlots = slotsByAsset.get(asset.id) ?? []
                const coveringSlots = assetSlots.filter((slot) => {
                  const start = timeToMinutes(slot.startTime)
                  const end = timeToMinutes(slot.endTime)
                  return start < rowEnd && end > rowStart
                })
                const startingSlots = coveringSlots.filter(
                  (slot) =>
                    Math.floor(
                      (timeToMinutes(slot.startTime) - axis.start) / axis.step,
                    ) === row.index,
                )
                const isCovered = coveringSlots.length > 0
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
                        aria-label={`${asset.name}, ${minutesToTime(rowStart)}–${minutesToTime(rowEnd)}`}
                        className="h-full w-full rounded-md border border-dashed border-transparent text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
                        onClick={() =>
                          onCellClick({
                            rentalAssetId: asset.id,
                            assetName: asset.name,
                            date,
                            startTime: minutesToTime(rowStart),
                            endTime: minutesToTime(rowEnd),
                            slot: null,
                          })
                        }
                      >
                        <span className="sr-only">
                          {t("rentals.schedule.grid.empty")}
                        </span>
                      </button>
                    ) : null}
                    {startingSlots.map((slot, stackIndex) => {
                      const slotStart = timeToMinutes(slot.startTime)
                      const overlapIndex =
                        assetSlots.filter(
                          (other) =>
                            other.id !== slot.id &&
                            timeToMinutes(other.startTime) < slotStart &&
                            timeToMinutes(other.endTime) > slotStart,
                        ).length + stackIndex
                      const rows = Math.max(
                        1,
                        Math.ceil(
                          (timeToMinutes(slot.endTime) -
                            timeToMinutes(slot.startTime)) /
                            axis.step,
                        ),
                      )
                      const status = statusKey(slot)
                      const busyKey = `${slot.rentalAssetId}|${slot.startTime}|${slot.id}`
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={readOnly || busyTargetKey === busyKey}
                          aria-label={`${asset.name}, ${slot.occupancyKindLabel}, ${t(`rentals.schedule.occurrence.status.${status}`)}`}
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
                              slot.occupancyKindColorHex ?? "var(--border)",
                            backgroundColor: slot.occupancyKindColorHex
                              ? `${slot.occupancyKindColorHex}20`
                              : "var(--muted)",
                          }}
                          onClick={() =>
                            onCellClick({
                              rentalAssetId: asset.id,
                              assetName: asset.name,
                              date,
                              startTime: slot.startTime,
                              endTime: slot.endTime,
                              slot,
                            })
                          }
                        >
                          <span className="block truncate text-xs font-semibold">
                            {slot.label || slot.occupancyKindLabel}
                          </span>
                          <span className="mt-1 inline-flex rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium">
                            {t(`rentals.schedule.occurrence.status.${status}`)}
                          </span>
                          {slot.source === "DailyOverride" ? (
                            <span className="ml-1 inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                              {t("rentals.schedule.occurrence.source.dailyOverride")}
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
