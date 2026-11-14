import { useState, type MouseEvent } from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { cn } from "@/lib/utils"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { agendaKindTone } from "./agendaKindTone"
import { useIsMedium } from "./agendaFilterModel"
import { clipBlock, formatClock, layoutLanes, type AgendaBlock, type AgendaRow } from "./dayGridModel"
import type { AgendaSourceId } from "./useAgendaDay"
import { AgendaProductPads } from "./AgendaProductPads"

const RESOURCE_COLUMN = "grid-cols-[13.75rem_minmax(0,1fr)]"
// Row geometry: one lane is 3.5rem (block 3.25rem + gap); a single-lane row is 4.25rem.
const LANE_REM = 3.5
const ROW_PADDING_REM = 0.75

function orderNumber(block: AgendaBlock): string | null {
  if (!block.orderId) return null
  const number = block.displayNumber?.trim()
  return number ? number : block.orderId.slice(0, 8)
}

type Translate = (key: string, options?: Record<string, string>) => string

function blockHeading(block: AgendaBlock, kindLabel: string, t: Translate): string {
  if (block.kind === "pedido") {
    const product = block.productName?.trim()
    if (product) return product
    const number = orderNumber(block)
    const customer = block.customerName?.trim()
    if (number && customer) return t("staffAgenda.orderWithCustomer", { number, customer })
    if (number) return t("staffAgenda.orderHeading", { number })
  }
  if (block.kind === "reserva") {
    const customer = block.customerName?.trim()
    if (customer) return customer
  }
  const label = block.label?.trim()
  if (label && !/^[A-Z][A-Za-z]+$/.test(label)) return label
  return kindLabel
}

/** Line 1 (title) and the description that follows the time on line 2. */
function blockLines(block: AgendaBlock, kindLabel: string, t: Translate): { title: string; description: string | null } {
  const heading = blockHeading(block, kindLabel, t)
  if (block.kind === "pedido") {
    const number = orderNumber(block)
    const customer = block.customerName?.trim()
    const product = block.productName?.trim() || null
    if (number) return { title: customer ? t("staffAgenda.orderWithCustomer", { number, customer }) : t("staffAgenda.orderHeading", { number }), description: product }
    return { title: heading, description: null }
  }
  return { title: heading, description: heading === kindLabel ? null : kindLabel }
}

function blockTitle(block: AgendaBlock, kindLabel: string, heading: string): string {
  return `${kindLabel} ${formatClock(block.start)} ${formatClock(block.end)} ${heading}`
}

function resourceMeta(row: AgendaRow, t: Translate): string {
  const kind = row.resourceType ? t(`agendas.grid.resourceType.${row.resourceType}`) : null
  return [kind, row.categoryName?.trim()].filter(Boolean).join(" · ")
}

type AgendaDayGridProps = {
  loading: boolean
  failedSources: AgendaSourceId[]
  rows: AgendaRow[]
  /** Axis in minutes from midnight (see `agendaAxis`). */
  start: number
  end: number
  canReserve: boolean
  canBlock: boolean
  /** Minutes of the current time when the shown day is today, else null (tints the current hour). */
  nowMinutes?: number | null
  /** Opens the create-reservation flow for a resource at a slot time (minutes from midnight). */
  onCreateReservation?: (resourceId: string, minutes: number) => void
  focusDate?: string
  focusedProductId?: string | null
}

export function AgendaDayGrid({ loading, failedSources, rows, start: axisStart, end: axisEnd, canReserve, canBlock, nowMinutes = null, onCreateReservation, focusedProductId, focusDate }: AgendaDayGridProps) {
  const { t } = useTranslation()
  const timeZone = useTenantTimeZone()
  const wide = useIsMedium()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const span = Math.max(axisEnd - axisStart, 1)
  const hours = Array.from({ length: Math.max(1, Math.ceil(span / 60)) }, (_, index) => axisStart + index * 60)
  const selected = selectedKey
    ? rows.flatMap((row) => row.blocks.map((block) => ({ block, row }))).find((item) => item.block.key === selectedKey) ?? null
    : null
  const create = canReserve && onCreateReservation ? onCreateReservation : null
  const pct = (minutes: number) => ((minutes - axisStart) / span) * 100
  const tintHour = nowMinutes !== null && nowMinutes >= axisStart && nowMinutes < axisEnd ? Math.floor((nowMinutes - axisStart) / 60) : null

  if (loading) {
    return (
      <div role="status" aria-label={t("staffAgenda.gridLoading")} className="space-y-3 border-t p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const warnings = failedSources.map((source) => (
    <p key={source} role="status" className="border-t px-5 py-2 text-sm text-muted-foreground">
      {t(`staffAgenda.sourceWarning.${source}`)}
    </p>
  ))

  if (!wide) {
    return (
      <div data-layout="list">
        {warnings}
        <section aria-label={t("staffAgenda.grid")}>
          {rows.map((row) => {
            const ordered = [...row.blocks].sort((a, b) => a.start - b.start || a.end - b.end)
            return (
              <div key={row.id}>
                <section aria-label={row.name} className="space-y-2 border-t px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-sm font-medium">{row.name}</h2>
                      <p className="text-xs text-muted-foreground">{resourceMeta(row, t)}</p>
                    </div>
                    <RowMenu row={row} axisStart={axisStart} canBlock={canBlock} create={create} />
                  </div>
                  {ordered.map((block) => {
                    const kindLabel = t(`staffAgenda.types.${block.kind}`)
                    const { title } = blockLines(block, kindLabel, t)
                    const name = blockTitle(block, kindLabel, blockHeading(block, kindLabel, t))
                    return (
                      <button
                        key={block.key}
                        type="button"
                        aria-pressed={selectedKey === block.key}
                        aria-label={name}
                        title={name}
                        className={cn(
                          "touch-target relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-md border-l-[3px] px-3 py-2 text-left text-sm",
                          agendaKindTone[block.kind].block,
                          focusedProductId && block.productId !== focusedProductId && "opacity-40",
                        )}
                        onClick={() => setSelectedKey(block.key)}
                      >
                        {focusedProductId === block.productId && focusDate && <AgendaProductPads block={block} date={focusDate} timeZone={timeZone} />}
                        <span className="relative shrink-0 text-xs tabular-nums text-muted-foreground">{formatClock(block.start)} – {formatClock(block.end)}</span>
                        <span className={cn("relative truncate font-medium", agendaKindTone[block.kind].title)}>{title}</span>
                      </button>
                    )
                  })}
                  {row.blocks.length === 0 && (create ? (
                    <button type="button" className="touch-target min-h-11 w-full rounded-md text-left text-xs text-muted-foreground hover:bg-muted" aria-label={t("agendas.grid.reserveOn", { name: row.name })} onClick={() => create(row.id, axisStart)}>
                      {t("agendas.grid.available")}
                    </button>
                  ) : <p className="text-xs text-muted-foreground">{t("agendas.grid.available")}</p>)}
                </section>
                {selected?.row.id === row.id && <BlockDetail block={selected.block} resourceName={selected.row.name} onClose={() => setSelectedKey(null)} />}
              </div>
            )
          })}
        </section>
      </div>
    )
  }

  return (
    <div data-layout="grid">
      {warnings}
      <section aria-label={t("staffAgenda.grid")} className="overflow-x-auto">
        <div style={{ minWidth: `calc(13.75rem + ${hours.length * 4.5}rem)` }}>
          <div className={cn("grid border-t", RESOURCE_COLUMN)}>
            <span className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("staffAgenda.recurso")}</span>
            <div className="relative h-11" aria-hidden="true">
              {hours.map((minutes) => (
                <span key={minutes} className="absolute top-3 whitespace-nowrap pl-2 text-xs tabular-nums text-muted-foreground" style={{ left: `${pct(minutes)}%` }}>
                  {formatClock(minutes)}
                </span>
              ))}
            </div>
          </div>
          {rows.map((row) => {
            const placed = layoutLanes(row.blocks).flatMap(({ block, lane }) => {
              const clip = clipBlock(block, axisStart, axisEnd)
              return clip ? [{ block, lane, clip }] : []
            })
            const hidden = row.blocks.length - placed.length
            const laneCount = Math.max(1, placed.reduce((max, item) => Math.max(max, item.lane + 1), 0))
            const empty = row.blocks.length === 0
            const reserve = (event: MouseEvent<HTMLButtonElement>) => {
              if (!create) return
              const rect = event.currentTarget.getBoundingClientRect()
              const ratio = rect.width > 0 ? Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) : 0
              const hour = Math.min(Math.floor((ratio * span) / 60) * 60, Math.max(span - 60, 0))
              create(row.id, axisStart + hour)
            }
            return (
              <div key={row.id}>
                <section aria-label={row.name} className={cn("group/row grid border-t", RESOURCE_COLUMN)}>
                  <div className="flex min-w-0 items-center justify-between gap-1 px-5 py-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-medium">{row.name}</h2>
                      <p className="truncate text-xs text-muted-foreground">{resourceMeta(row, t)}</p>
                    </div>
                    <RowMenu row={row} axisStart={axisStart} canBlock={canBlock} create={create} reveal />
                  </div>
                  <div className="relative border-l" style={{ minHeight: `${Math.max(4.25, laneCount * LANE_REM + ROW_PADDING_REM)}rem` }}>
                    {tintHour !== null && <div aria-hidden="true" data-testid="now-hour" className="absolute inset-y-0 bg-muted/60" style={{ left: `${pct(axisStart + tintHour * 60)}%`, width: `${(60 / span) * 100}%` }} />}
                    {hours.slice(1).map((minutes) => <div key={minutes} aria-hidden="true" className="absolute inset-y-0 border-l" style={{ left: `${pct(minutes)}%` }} />)}
                    {create ? (
                      <button type="button" aria-label={t("agendas.grid.reserveOn", { name: row.name })} className="absolute inset-0 flex cursor-pointer items-center px-4 text-left text-xs text-muted-foreground outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={reserve}>
                        {empty && t("agendas.grid.available")}
                      </button>
                    ) : empty ? (
                      <p className="absolute inset-0 flex items-center px-4 text-xs text-muted-foreground">{t("agendas.grid.available")}</p>
                    ) : null}
                    {placed.map(({ block, lane, clip }) => {
                      const kindLabel = t(`staffAgenda.types.${block.kind}`)
                      const { title, description } = blockLines(block, kindLabel, t)
                      const name = blockTitle(block, kindLabel, blockHeading(block, kindLabel, t))
                      const tone = agendaKindTone[block.kind]
                      const left = pct(clip.start)
                      const width = Math.max(1.5, pct(clip.end) - left)
                      const clipped = clip.clippedStart || clip.clippedEnd
                      const time = clip.allDay ? t("agendas.grid.allDay") : `${formatClock(block.start)} – ${formatClock(block.end)}`
                      return (
                        <button
                          key={block.key}
                          type="button"
                          aria-pressed={selectedKey === block.key}
                          aria-label={name}
                          title={clipped ? `${name} (${t("agendas.grid.continues")})` : name}
                          data-clipped={clipped ? "true" : undefined}
                          className={cn(
                            "absolute flex flex-col justify-center overflow-hidden rounded-md border-l-[3px] px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            tone.block,
                            clip.clippedEnd && "pr-6",
                            focusedProductId && block.productId !== focusedProductId && "opacity-40",
                          )}
                          style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, top: `${0.5 + lane * LANE_REM}rem`, height: "3.25rem" }}
                          onClick={() => setSelectedKey(block.key)}
                        >
                          {focusedProductId === block.productId && focusDate && !clipped && <AgendaProductPads block={block} date={focusDate} timeZone={timeZone} />}
                          <span className={cn("relative block truncate text-xs font-medium", tone.title)}>{title}</span>
                          <span className="relative block truncate text-xs tabular-nums text-muted-foreground">{description ? `${time} · ${description}` : time}</span>
                          {clip.clippedEnd && <ChevronRight className={cn("absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground", ICON_SIZE.sm)} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />}
                          {clip.clippedStart && <ChevronLeft className={cn("absolute left-0.5 top-1/2 -translate-y-1/2 text-muted-foreground", ICON_SIZE.sm)} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />}
                        </button>
                      )
                    })}
                    {hidden > 0 && <p className="pointer-events-none absolute bottom-1 right-2 text-xs text-muted-foreground">{t("agendas.grid.outside", { count: hidden })}</p>}
                  </div>
                </section>
              </div>
            )
          })}
        </div>
      </section>
      {selected && <BlockDetail block={selected.block} resourceName={selected.row.name} onClose={() => setSelectedKey(null)} />}
    </div>
  )
}

/** Kebab of a resource row: reserve or block this resource. Hidden when the viewer can do neither. */
function RowMenu({ row, axisStart, canBlock, create, reveal }: { row: AgendaRow; axisStart: number; canBlock: boolean; create: ((resourceId: string, minutes: number) => void) | null; reveal?: boolean }) {
  const { t } = useTranslation()
  if (!canBlock && !create) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="icon" className={cn("touch-target size-11 shrink-0", reveal && "md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100 md:aria-expanded:opacity-100")} aria-label={t("agendas.grid.rowActions", { name: row.name })} />}
      >
        <MoreHorizontal className={ICON_SIZE.md} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {create && <DropdownMenuItem className="min-h-11" onClick={() => create(row.id, row.open ?? axisStart)}>{t("agendas.grid.reserveHere")}</DropdownMenuItem>}
        {canBlock && <DropdownMenuItem className="min-h-11" render={<Link to="/configuracoes/agenda" />}>{t("staffAgenda.blockPeriod")}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BlockDetail({ block, resourceName, onClose }: { block: AgendaBlock; resourceName: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const kindLabel = t(`staffAgenda.types.${block.kind}`)
  const statusKey = block.orderStatus ? `catalog.status.${block.orderStatus}` : null
  return (
    <section aria-label={t("staffAgenda.detail")} aria-live="polite" className="border-t bg-muted/30 px-5 py-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{blockHeading(block, kindLabel, t)}</h2>
        <Button type="button" variant="outline" onClick={onClose}>{t("staffAgenda.closeDetail")}</Button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t("staffAgenda.tipo")}</dt>
          <dd>{kindLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("staffAgenda.when")}</dt>
          <dd className="font-medium text-foreground tabular-nums whitespace-nowrap">{t("staffAgenda.timeRange", { start: formatClock(block.start), end: formatClock(block.end) })}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("staffAgenda.recurso")}</dt>
          <dd><Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/configuracoes/recursos/${block.resourceId}`}>{resourceName}</Link></dd>
        </div>
        {block.productId && block.productName && (
          <div>
            <dt className="text-muted-foreground">{t("staffAgenda.produto")}</dt>
            <dd><Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/catalogo/produtos/${block.productId}`}>{block.productName}</Link></dd>
          </div>
        )}
        {orderNumber(block) && (
          <div>
            <dt className="text-muted-foreground">{t("staffAgenda.pedido")}</dt>
            <dd><Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/pedidos/${block.orderId}`}>{orderNumber(block)}</Link></dd>
          </div>
        )}
        {statusKey && i18n.exists(statusKey) && (
          <div>
            <dt className="text-muted-foreground">{t("staffAgenda.status")}</dt>
            <dd className="text-foreground">{t(statusKey)}</dd>
          </div>
        )}
        {block.kind === "reserva" && (
          <div>
            <dt className="text-muted-foreground">{t("staffAgenda.types.reserva")}</dt>
            <dd><Link className="font-medium text-primary underline-offset-4 hover:underline" to="/configuracoes/reservas">{t("staffAgenda.openReservations")}</Link></dd>
          </div>
        )}
        {block.customerName && (
          <div>
            <dt className="text-muted-foreground">{t("staffAgenda.customer")}</dt>
            <dd>{block.customerName}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
