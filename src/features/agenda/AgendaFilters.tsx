import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { fold } from "./agendaFilterModel"
import { agendaOptionLoaders, useAgendaOptions, type AgendaOption } from "./useAgendaOptions"

const emptyOptions = async (): Promise<AgendaOption[]> => []

function matching(options: AgendaOption[], query: string) {
  const needle = fold(query.trim())
  if (!needle) return options
  return options.filter((option) => fold(option.label).includes(needle))
}

function optionLabel(options: AgendaOption[], value: string | null) {
  if (!value) return null
  return options.find((option) => option.id === value)?.label ?? value
}

type AgendaFiltersProps = {
  /** Whether the user may read orders (the search is hidden otherwise). */
  order: boolean
  value: string | null
  onChange: (pedido: string | null) => void
}

/** "Pedido ou cliente" search of the agenda toolbar; the order id lives in the `pedido` URL param. */
export function AgendaFilters({ order, value, onChange }: AgendaFiltersProps) {
  const { t } = useTranslation()
  const pedido = useAgendaOptions(order ? agendaOptionLoaders.pedido : emptyOptions)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  if (!order) return null
  const label = t("staffAgenda.pedido")
  const selected = optionLabel(pedido.options, value)
  const shown = matching(pedido.options, query).slice(0, query.trim() ? 6 : 8)
  const listId = "agenda-order-results"
  return (
    <div ref={rootRef} className="relative w-full min-w-0 md:w-80">
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3">
        <Search className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        {selected && (
          <span className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full bg-primary/15 px-2 py-0.5 text-sm">
            <span className="truncate">{selected}</span>
            <button type="button" className="touch-target inline-flex size-6 items-center justify-center rounded-full hover:bg-muted" aria-label={t("staffAgenda.removeFilter", { label: selected })} onClick={() => onChange(null)}>
              <X className={ICON_SIZE.xs} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            </button>
          </span>
        )}
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={t("staffAgenda.searchOrder")}
          placeholder={selected ? t("staffAgenda.replaceOrder") : t("staffAgenda.orderPlaceholder")}
          value={query}
          onFocus={() => { setOpen(true); setQuery("") }}
          onChange={(event) => { setOpen(true); setQuery(event.target.value) }}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {pedido.loading && <div role="status" aria-label={t("staffAgenda.loading", { label })} className="mt-2"><Skeleton variant="shimmer" className="h-11 w-40 rounded-full" /></div>}
      {pedido.error && <p role="alert" className="mt-2 text-sm text-destructive">{t("staffAgenda.loadError", { label })}</p>}
      {open && (
        <div id={listId} role="listbox" aria-label={label} className="absolute left-0 top-full z-20 mt-1 w-full min-w-72 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md">
          {shown.map((option) => (
            <button key={option.id} type="button" role="option" aria-selected={option.id === value} className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted" onClick={() => { onChange(option.id); setOpen(false); setQuery("") }}>
              {option.label}
            </button>
          ))}
          {shown.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t("staffAgenda.noResults", { query })}</p>}
        </div>
      )}
    </div>
  )
}
