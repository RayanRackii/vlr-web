import { useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { AgendaBlock, AgendaRow } from "./dayGridModel"

const DEFAULT_START_MINUTES = 6 * 60
const DEFAULT_END_MINUTES = 23 * 60

const kindClass: Record<AgendaBlock["kind"], string> = {
  pedido: "border-primary bg-primary/15 text-foreground",
  reserva: "border-foreground/25 bg-accent text-accent-foreground",
  manutencao: "border-dashed border-foreground/40 bg-muted text-foreground",
  bloqueio: "border-border bg-muted text-muted-foreground",
}

function formatClock(minutes: number): string {
  if (minutes >= 1440) return "24:00"
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function hourMarks(start: number | null, end: number | null): number[] {
  const first = Math.floor((start ?? DEFAULT_START_MINUTES) / 60)
  const last = Math.max(first + 1, Math.ceil((end ?? DEFAULT_END_MINUTES) / 60))
  return Array.from({ length: last - first + 1 }, (_, index) => first + index)
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

function orderLinkText(block: AgendaBlock): string | null {
  if (!block.orderId) return null
  const number = block.displayNumber?.trim()
  return number ? number : block.orderId.slice(0, 8)
}

function blockTitle(block: AgendaBlock, kindLabel: string): string {
  const name = block.productName || block.customerName || block.label || kindLabel
  return `${kindLabel} ${formatClock(block.start)} ${formatClock(block.end)} ${name}`
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

export function AgendaDayGrid({ loading, error, rows, start, end, canReserve, canBlock }: AgendaDayGridProps) {
  const { t } = useTranslation()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const marks = hourMarks(start, end)
  const origin = marks[0] * 60
  const span = Math.max((marks[marks.length - 1] - marks[0]) * 60, 1)
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
            <div className="relative h-8 min-w-0 flex-1">
              {marks.map((hour, index) => {
                const edge = index === 0 ? "0" : index === marks.length - 1 ? "-100%" : "-50%"
                return (
                  <span key={hour} className="absolute top-2 text-xs tabular-nums text-muted-foreground" style={{ left: `${(index / Math.max(marks.length - 1, 1)) * 100}%`, transform: `translateX(${edge})` }}>
                    {formatClock(hour * 60)}
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
                        return (
                          <button
                            key={block.key}
                            type="button"
                            aria-pressed={selectedKey === block.key}
                            className={`block w-full rounded-md border px-3 py-2 text-left text-sm font-medium ${kindClass[block.kind]}`}
                            onClick={() => setSelectedKey(block.key)}
                          >
                            {blockTitle(block, kindLabel)}
                          </button>
                        )
                      })}
                      {row.blocks.length === 0 && <EmptyRow canReserve={canReserve} canBlock={canBlock} />}
                    </div>
                  ) : (
                    <>
                      <div className="flex">
                        <h2 className="w-44 shrink-0 px-3 py-3 text-sm font-medium">{row.name}</h2>
                        <div className="relative min-w-0 flex-1 border-l" style={{ minHeight: `${laneCount * 2.75}rem` }}>
                          {placed.map(({ block, lane }) => {
                            const left = Math.max(0, ((block.start - origin) / span) * 100)
                            const width = Math.max(1.5, ((Math.min(block.end, origin + span) - Math.max(block.start, origin)) / span) * 100)
                            const kindLabel = t(`staffAgenda.types.${block.kind}`)
                            return (
                              <button
                                key={block.key}
                                type="button"
                                aria-pressed={selectedKey === block.key}
                                className={`absolute truncate rounded-md border px-2 text-left text-xs font-medium ${kindClass[block.kind]}`}
                                style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, top: `${lane * 2.5 + 0.35}rem`, height: "2.15rem" }}
                                onClick={() => setSelectedKey(block.key)}
                              >
                                {blockTitle(block, kindLabel)}
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
  const { t } = useTranslation()
  const kindLabel = t(`staffAgenda.types.${block.kind}`)
  return (
    <section aria-label={t("staffAgenda.detail")} aria-live="polite" className="rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{block.productName || block.customerName || block.label || kindLabel}</h2>
        <Button type="button" variant="outline" onClick={onClose}>{t("staffAgenda.closeDetail")}</Button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">{t("staffAgenda.tipo")}</dt>
          <dd>{kindLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("staffAgenda.when")}</dt>
          <dd className="tabular-nums">{formatClock(block.start)}–{formatClock(block.end)}</dd>
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
        {orderLinkText(block) && (
          <div>
            <dt className="text-muted-foreground">{t("staffAgenda.pedido")}</dt>
            <dd><Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/catalogo/pedidos/${block.orderId}`}>{orderLinkText(block)}</Link></dd>
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
