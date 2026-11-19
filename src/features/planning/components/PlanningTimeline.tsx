import { useTranslation } from "react-i18next"
import { formatDayLabel, formatZonedTime } from "@/features/catalog/components/agenda/agendaLayout"
import { cn } from "@/lib/utils"
import {
  DAY_MINUTES,
  formatMinutes,
  minutesAtFraction,
  type DayRowModel,
  type PlacedBlock,
  type WeekRowModel,
} from "../model/gridModel"
import type { PlanningAllocation } from "../schemas/planningSchemas"
import { expiredClass, overdueBorder, planningTone } from "./planningTone"

const LABEL_COLUMN = "grid-cols-[9.5rem_minmax(0,1fr)] md:grid-cols-[13rem_minmax(0,1fr)]"
const LANE_REM = 2.75
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const HOUR_COLUMNS = { gridTemplateColumns: "repeat(24, minmax(0, 1fr))" } as const

type Translate = (key: string, options?: Record<string, unknown>) => string

function blockLabel(block: PlacedBlock, t: Translate, locale: string, zone: string): string {
  const { allocation } = block
  const state = [t(`planning.status.${allocation.status}`)]
  if (block.overdue) state.push(t("planning.flags.overdue"))
  if (block.expired) state.push(t("planning.flags.expired"))
  const time = `${formatZonedTime(allocation.occupiedStart, locale, zone)} – ${formatZonedTime(allocation.occupiedEnd, locale, zone)}`
  return `${allocation.title || t(`planning.kind.${allocation.kind || "Use"}`)}, ${time}, ${state.join(", ")}`
}

function BlockFlags({ block, t }: { block: PlacedBlock; t: Translate }) {
  if (!block.overdue && !block.expired) return null
  return (
    <span className={cn("ml-1 shrink-0 rounded px-1 text-[0.65rem] font-semibold uppercase", block.overdue ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
      {block.overdue ? t("planning.flags.overdue") : t("planning.flags.expired")}
    </span>
  )
}

type DayProps = {
  rows: DayRowModel[]
  timeZone: string
  nowMinutes: number | null
  canCreate: boolean
  onSelect: (allocation: PlanningAllocation) => void
  onCreate: (assetId: string, minutes: number) => void
}

/** One row per plannable asset across the 24 hours of the day. Scrolls sideways inside its own container. */
export function PlanningDayGrid({ rows, timeZone, nowMinutes, canCreate, onSelect, onCreate }: DayProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  return (
    <div className="max-w-full overflow-x-auto border-t" data-testid="planning-day-grid" tabIndex={0} role="region" aria-label={t("planning.grid.dayRegion")}>
      <div className="min-w-[64rem]">
        <div className={cn("grid border-b bg-muted/30 text-xs text-muted-foreground", LABEL_COLUMN)}>
          <div className="sticky left-0 z-20 bg-card px-4 py-2 font-medium">{t("planning.grid.asset")}</div>
          <div className="relative grid" style={HOUR_COLUMNS} aria-hidden>
            {HOURS.map((hour) => <div key={hour} className="border-l px-1 py-2 tabular-nums first:border-l-0">{String(hour).padStart(2, "0")}</div>)}
          </div>
        </div>
        {rows.map((row) => {
          const height = `${row.laneCount * LANE_REM + 0.5}rem`
          return (
            <div key={row.resource.assetId} className={cn("grid border-b last:border-b-0", LABEL_COLUMN)} data-testid="planning-row">
              <div className="sticky left-0 z-10 min-w-0 border-r bg-card px-4 py-2">
                <p className="truncate text-sm font-medium">{row.resource.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[row.resource.tag, row.resource.unitName].filter(Boolean).join(" · ")}</p>
              </div>
              <div
                className={cn("relative", canCreate && "cursor-pointer")}
                style={{ height }}
                onClick={(event) => {
                  if (!canCreate || (event.target as HTMLElement).closest("[data-planning-block]")) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  onCreate(row.resource.assetId, minutesAtFraction((event.clientX - rect.left) / rect.width))
                }}
              >
                <div className="pointer-events-none absolute inset-0 grid" style={HOUR_COLUMNS} aria-hidden>
                  {HOURS.map((hour) => <div key={hour} className="border-l first:border-l-0" />)}
                </div>
                {row.closed.map((segment) => (
                  <div
                    key={`closed-${segment.start}`}
                    data-testid="planning-closed"
                    className="pointer-events-none absolute inset-y-0 bg-muted/70"
                    style={{ left: `${(segment.start / DAY_MINUTES) * 100}%`, width: `${((segment.end - segment.start) / DAY_MINUTES) * 100}%` }}
                    title={t("planning.grid.closed")}
                  />
                ))}
                {row.external.map((segment) => (
                  <div
                    key={`external-${segment.start}`}
                    data-testid="planning-external"
                    className="agenda-product-pad pointer-events-none absolute inset-y-1 rounded-sm border border-border"
                    style={{ left: `${(segment.start / DAY_MINUTES) * 100}%`, width: `${((segment.end - segment.start) / DAY_MINUTES) * 100}%` }}
                    title={t("planning.grid.externalBusy")}
                  />
                ))}
                {nowMinutes !== null && <div className="pointer-events-none absolute inset-y-0 w-px bg-destructive/70" style={{ left: `${(nowMinutes / DAY_MINUTES) * 100}%` }} aria-hidden />}
                {row.blocks.map((block) => {
                  const tone = planningTone[block.tone]
                  return (
                    <button
                      key={block.key}
                      type="button"
                      data-planning-block
                      aria-label={blockLabel(block, t, locale, row.resource.timeZoneId || timeZone)}
                      title={blockLabel(block, t, locale, row.resource.timeZoneId || timeZone)}
                      onClick={() => onSelect(block.allocation)}
                      className={cn(
                        "absolute flex min-w-[1.5rem] flex-col justify-center overflow-hidden rounded-md border border-l-[3px] px-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        tone.block,
                        block.overdue && overdueBorder,
                        block.expired && expiredClass,
                      )}
                      style={{ left: `${block.leftPct}%`, width: `${block.widthPct}%`, top: `${block.lane * LANE_REM + 0.25}rem`, height: `${LANE_REM - 0.25}rem` }}
                    >
                      {block.segments.prep > 0 && <span className="pointer-events-none absolute inset-y-0 left-0 bg-foreground/10" style={{ width: `${block.segments.prep * 100}%` }} aria-hidden />}
                      {block.segments.cleanup > 0 && <span className="pointer-events-none absolute inset-y-0 right-0 bg-foreground/10" style={{ width: `${block.segments.cleanup * 100}%` }} aria-hidden />}
                      <span className="relative flex min-w-0 items-center">
                        <span className="truncate font-medium">{block.allocation.title || t(`planning.kind.${block.allocation.kind || "Use"}`)}</span>
                        <BlockFlags block={block} t={t} />
                      </span>
                      <span className="relative truncate tabular-nums text-muted-foreground">{formatMinutes(block.start)}–{block.end >= DAY_MINUTES ? "24:00" : formatMinutes(block.end)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type WeekProps = {
  days: string[]
  rows: WeekRowModel[]
  today: string
  timeZone: string
  canCreate: boolean
  onSelect: (allocation: PlanningAllocation) => void
  onOpenDay: (date: string) => void
  onCreate: (assetId: string, date: string) => void
}

const MAX_CHIPS = 3

/** Seven days per asset: a compact list of what is booked on each day. */
export function PlanningWeekGrid({ days, rows, today, timeZone, canCreate, onSelect, onOpenDay, onCreate }: WeekProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const columns = "grid-cols-[9.5rem_repeat(7,minmax(7.5rem,1fr))] md:grid-cols-[13rem_repeat(7,minmax(7.5rem,1fr))]"
  return (
    <div className="max-w-full overflow-x-auto border-t" data-testid="planning-week-grid" tabIndex={0} role="region" aria-label={t("planning.grid.weekRegion")}>
      <div className="min-w-[62rem]">
        <div className={cn("grid border-b bg-muted/30 text-xs", columns)}>
          <div className="sticky left-0 z-20 bg-card px-4 py-2 font-medium text-muted-foreground">{t("planning.grid.asset")}</div>
          {days.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => onOpenDay(date)}
              className={cn("border-l px-2 py-2 text-left font-medium capitalize hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", date === today && "text-primary")}
              aria-label={t("planning.grid.openDay", { day: formatDayLabel(date, locale) })}
            >
              {formatDayLabel(date, locale)}
            </button>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.resource.assetId} className={cn("grid border-b last:border-b-0", columns)} data-testid="planning-row">
            <div className="sticky left-0 z-10 min-w-0 border-r bg-card px-4 py-2">
              <p className="truncate text-sm font-medium">{row.resource.name}</p>
              <p className="truncate text-xs text-muted-foreground">{[row.resource.tag, row.resource.unitName].filter(Boolean).join(" · ")}</p>
            </div>
            {row.cells.map((cell) => (
              <div
                key={cell.date}
                data-testid="planning-week-cell"
                className={cn("min-h-[5rem] min-w-0 space-y-1 border-l p-1.5", cell.closedAllDay && "bg-muted/60", canCreate && !cell.closedAllDay && "cursor-pointer hover:bg-muted/30")}
                onClick={(event) => {
                  if (canCreate && !(event.target as HTMLElement).closest("[data-planning-block]")) onCreate(row.resource.assetId, cell.date)
                }}
              >
                {cell.closedAllDay && cell.blocks.length === 0 && <p className="text-xs text-muted-foreground">{t("planning.grid.closed")}</p>}
                {cell.blocks.slice(0, MAX_CHIPS).map((block) => {
                  const tone = planningTone[block.tone]
                  const zone = row.resource.timeZoneId || timeZone
                  return (
                    <button
                      key={block.key}
                      type="button"
                      data-planning-block
                      aria-label={blockLabel(block, t, locale, zone)}
                      onClick={() => onSelect(block.allocation)}
                      className={cn("flex w-full min-w-0 flex-col rounded-md border border-l-[3px] px-1.5 py-1 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tone.block, block.overdue && overdueBorder, block.expired && expiredClass)}
                    >
                      <span className="flex min-w-0 items-center"><span className="truncate font-medium">{block.allocation.title || t(`planning.kind.${block.allocation.kind || "Use"}`)}</span><BlockFlags block={block} t={t} /></span>
                      <span className="truncate tabular-nums text-muted-foreground">{formatMinutes(block.start)}–{block.end >= DAY_MINUTES ? "24:00" : formatMinutes(block.end)}</span>
                    </button>
                  )
                })}
                {cell.blocks.length > MAX_CHIPS && (
                  <button type="button" data-planning-block onClick={() => onOpenDay(cell.date)} className="text-xs font-medium text-primary hover:underline">
                    {t("planning.grid.more", { count: cell.blocks.length - MAX_CHIPS })}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
