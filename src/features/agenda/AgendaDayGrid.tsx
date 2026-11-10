import { useCallback, useRef, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { AgendaBlock, AgendaRow } from "./dayGridModel"
import { visibleHourLabels } from "./hourLabels"

const DEFAULT_START_MINUTES = 6 * 60
const DEFAULT_END_MINUTES = 23 * 60

const kindClass: Record<AgendaBlock["kind"], string> = {
  pedido: "border-primary bg-primary/15 text-foreground",
  reserva: "border-foreground/25 bg-accent text-accent-foreground",
  manutencao: "border-dashed border-foreground/40 bg-muted text-foreground",
  bloqueio: "border-border bg-muted text-muted-foreground",
}

function formatClock(minutes: number): string {
  const bounded = Math.min(Math.max(minutes, 0), 24 * 60)
  if (bounded === 24 * 60) return "00:00"
  const hour = Math.floor(bounded / 60)
  const minute = bounded % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function axisBounds(start: number | null, end: number | null) {
  const axisStart = Math.floor((start ?? DEFAULT_START_MINUTES) / 60) * 60
  const axisEnd = Math.max(axisStart + 60, Math.ceil((end ?? DEFAULT_END_MINUTES) / 60) * 60)
  return { axisStart, axisEnd }
}

const NARROW_AGENDA = "(max-width: 639px)"

function subscribeNarrowAgenda(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const media = window.matchMedia(NARROW_AGENDA)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function narrowAgendaSnapshot() {
  return typeof window.matchMedia === "function" && window.matchMedia(NARROW_AGENDA).matches
}

function useNarrowAgenda() {
  return useSyncExternalStore(subscribeNarrowAgenda, narrowAgendaSnapshot, () => false)
}

function orderNumber(block: AgendaBlock): string | null {
  if (!block.orderId) return null
  const number = block.displayNumber?.trim()
  return number ? number : block.orderId.slice(0, 8)
}

function blockHeading(block: AgendaBlock, kindLabel: string, t: (key: string, options?: Record<string, string>) => string): string {
  if (block.kind === "pedido") {
    const product = block.productName?.trim()
    if (product) return product
    const number = orderNumber(block)
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

function blockTitle(block: AgendaBlock, kindLabel: string, heading: string): string {
  return `${kindLabel} ${formatClock(block.start)} ${formatClock(block.end)} ${heading}`
}

function lanes(blocks: AgendaBlock[]): { block: AgendaBlock; lane: number }[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.end - b.end)
  const ends: number[] = []
  return sorted.map((block) => {
    const open = ends.findIndex((end) => end <= block.start)
    const lane = open === -1 ? ends.length : open
    ends[lane] = block.end
    return { block, lane }
  })
}

type AgendaDayGridProps = {
  loading: boolean
  error: boolean
  rows: AgendaRow[]
  start: number | null
  end: number | null
  canReserve: boolean
  canBlock: boolean
}

function useTrackWidth() {
  const observerRef = useRef<ResizeObserver | null>(null)
  const [width, setWidth] = useState(0)
  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0)
      setWidth((current) => (current === next ? current : next))
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])
  return { ref, width }
}

export function AgendaDayGrid({ loading, error, rows, start, end, canReserve, canBlock }: AgendaDayGridProps) {
  const { t } = useTranslation()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { axisStart, axisEnd } = axisBounds(start, end)
  const span = Math.max(axisEnd - axisStart, 1)
  const { ref: trackRef, width: trackWidth } = useTrackWidth()
  const labels = visibleHourLabels(axisStart, axisEnd, trackWidth)
  const phone = useNarrowAgenda()
  const selected = selectedKey
    ? rows.flatMap((row) => row.blocks.map((block) => ({ block, row }))).find((item) => item.block.key === selectedKey) ?? null
    : null

  if (loading) {
    return (
      <div role="status" aria-label={t("staffAgenda.gridLoading")} className="space-y-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{t("staffAgenda.gridError")}</p>}
      <section aria-label={t("staffAgenda.grid")} className={phone ? "rounded-xl border bg-card text-card-foreground" : "overflow-x-auto rounded-xl border bg-card text-card-foreground"}>
        <div className={phone ? "" : "min-w-[48rem]"}>
          {!phone && <div className="flex border-b">
            <span className="w-44 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">{t("staffAgenda.recurso")}</span>
            <div ref={trackRef} className="relative h-8 min-w-0 flex-1">
              {labels.map((label) => {
                const shift = label.align === "start" ? "0" : label.align === "end" ? "-100%" : "-50%"
                return (
                  <span key={label.minutes} className="absolute top-2 whitespace-nowrap text-xs tabular-nums text-muted-foreground" style={{ left: `${label.leftPct}%`, transform: `translateX(${shift})` }}>
                    {formatClock(label.minutes)}
                  </span>
                )
              })}
            </div>
          </div>}
          {rows.map((row) => {
            const placed = lanes(row.blocks)
            const laneCount = Math.max(1, placed.reduce((max, item) => Math.max(max, item.lane + 1), 0))
            const ordered = [...row.blocks].sort((a, b) => a.start - b.start || a.end - b.end)
            return (
              <div key={row.id}>
                <section aria-label={row.name} className="border-b last:border-b-0">
                  {phone ? (
                    <div className="space-y-2 px-3 py-3">
                      <h2 className="text-sm font-medium">{row.name}</h2>
                      {ordered.map((block) => {
                        const kindLabel = t(`staffAgenda.types.${block.kind}`)
                        const heading = blockHeading(block, kindLabel, t)
                        const name = blockTitle(block, kindLabel, heading)
                        return (
                          <button
                            key={block.key}
                            type="button"
                            aria-pressed={selectedKey === block.key}
                            aria-label={name}
                            title={name}
                            className={`flex min-h-11 w-full items-center rounded-md border px-3 py-2 text-left text-sm font-medium ${kindClass[block.kind]}`}
                            onClick={() => setSelectedKey(block.key)}
                          >
                            <span className="truncate">{heading}</span>
                          </button>
                        )
                      })}
                      {row.blocks.length === 0 && <EmptyRow canReserve={canReserve} canBlock={canBlock} />}
                    </div>
                  ) : (
                    <>
                      <div className="flex">
                        <h2 className="w-44 shrink-0 px-3 py-3 text-sm font-medium">{row.name}</h2>
                        <div className="relative min-w-0 flex-1 border-l" style={{ minHeight: `${laneCount * 3}rem` }}>
                          {placed.map(({ block, lane }) => {
                            const left = Math.max(0, ((block.start - axisStart) / span) * 100)
                            const width = Math.max(1.5, ((Math.min(block.end, axisStart + span) - Math.max(block.start, axisStart)) / span) * 100)
                            const kindLabel = t(`staffAgenda.types.${block.kind}`)
                            const heading = blockHeading(block, kindLabel, t)
                            const name = blockTitle(block, kindLabel, heading)
                            const clamped = Math.min(width, 100 - left)
                            return (
                              <button
                                key={block.key}
                                type="button"
                                aria-pressed={selectedKey === block.key}
                                aria-label={name}
                                title={name}
                                className={`absolute flex items-center overflow-hidden rounded-md border px-2 text-sm font-medium ${clamped >= 50 ? "justify-center text-center" : "justify-start text-left"} ${kindClass[block.kind]}`}
                                style={{ left: `${left}%`, width: `${clamped}%`, top: `${lane * 2.75 + 0.25}rem`, height: "2.5rem" }}
                                onClick={() => setSelectedKey(block.key)}
                              >
                                <span className="truncate">{heading}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      {row.blocks.length === 0 && <EmptyRow canReserve={canReserve} canBlock={canBlock} />}
                    </>
                  )}
                </section>
                {phone && selected?.row.id === row.id && (
                  <BlockDetail block={selected.block} resourceName={selected.row.name} onClose={() => setSelectedKey(null)} />
                )}
              </div>
            )
          })}
        </div>
      </section>
      {!phone && selected && <BlockDetail block={selected.block} resourceName={selected.row.name} onClose={() => setSelectedKey(null)} />}
    </div>
  )
}

function EmptyRow({ canReserve, canBlock }: { canReserve: boolean; canBlock: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
      <p className="text-sm text-muted-foreground">{t("staffAgenda.emptyDay")}</p>
      <div className="flex flex-wrap gap-3">
        {canReserve && <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to="/configuracoes/reservas">{t("staffAgenda.createReservation")}</Link>}
        {canBlock && <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" to="/configuracoes/agenda">{t("staffAgenda.blockPeriod")}</Link>}
      </div>
    </div>
  )
}

function BlockDetail({ block, resourceName, onClose }: { block: AgendaBlock; resourceName: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const kindLabel = t(`staffAgenda.types.${block.kind}`)
  const statusKey = block.orderStatus ? `catalog.status.${block.orderStatus}` : null
  return (
    <section aria-label={t("staffAgenda.detail")} aria-live="polite" className="rounded-xl border bg-card p-4 text-card-foreground">
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
            <dd><Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/catalogo/pedidos/${block.orderId}`}>{orderNumber(block)}</Link></dd>
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
