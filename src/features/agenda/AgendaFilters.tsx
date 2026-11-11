import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Filter, Plus, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { agendaOptionLoaders, useAgendaOptions, type AgendaOption } from "./useAgendaOptions"
import { agendaTypes, type AgendaState } from "./urlState"

const NARROW_FILTERS = "(max-width: 639px)"
const emptyOptions = async (): Promise<AgendaOption[]> => []

function subscribePhone(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const media = window.matchMedia(NARROW_FILTERS)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

function usePhoneFilters() {
  return useSyncExternalStore(
    subscribePhone,
    () => typeof window.matchMedia === "function" && window.matchMedia(NARROW_FILTERS).matches,
    () => false,
  )
}

function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/#/g, "")
}

function matching(options: AgendaOption[], query: string) {
  const needle = fold(query.trim())
  if (!needle) return options
  return options.filter((option) => fold(option.label).includes(needle))
}

type FilterPatch = Partial<Pick<AgendaState, "recurso" | "produto" | "pedido" | "tipo">>

type AgendaFiltersProps = {
  modern?: boolean
  availableProducts?: AgendaOption[]
  requiredProduct?: boolean
  state: AgendaState
  rental: boolean
  product: boolean
  order: boolean
  onChange: (patch: FilterPatch) => void
}

export function AgendaFilters({ state, rental, product, order, onChange, modern = false, requiredProduct = false, availableProducts = [] }: AgendaFiltersProps) {
  const { t } = useTranslation()
  const phone = usePhoneFilters()
  const [panel, setPanel] = useState(false)
  const [open, setOpen] = useState<null | "recurso" | "produto" | "pedido">(null)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const recurso = useAgendaOptions(rental ? agendaOptionLoaders.recurso : emptyOptions)
  const produto = useAgendaOptions(product ? agendaOptionLoaders.produto : emptyOptions)
  const pedido = useAgendaOptions(order ? agendaOptionLoaders.pedido : emptyOptions)
  const count = [state.recurso, state.produto, state.pedido, state.tipo].filter(Boolean).length
  const clear = () => onChange({ recurso: null, produto: null, pedido: null, tipo: null })

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null)
        setQuery("")
      }
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [open])

  const togglePick = (key: "recurso" | "produto") => {
    setQuery("")
    setOpen((current) => (current === key ? null : key))
  }

  const search = order ? (
        <OrderSearch
          options={pedido.options}
          loading={pedido.loading}
          error={pedido.error}
          value={state.pedido}
          open={open === "pedido"}
          query={open === "pedido" ? query : ""}
          onQuery={(value) => { setOpen("pedido"); setQuery(value) }}
          onOpen={() => { setOpen("pedido"); setQuery("") }}
          onSelect={(pedidoId) => { onChange({ pedido: pedidoId }); setOpen(null); setQuery("") }}
          onClear={() => onChange({ pedido: null })}
        />
      ) : null
  const controls = (
    <>
      {!modern && search}
      {rental && (
        <PickFilter
          kind="recurso"
          options={recurso.options}
          loading={recurso.loading}
          error={recurso.error}
          value={state.recurso}
          open={open === "recurso"}
          query={open === "recurso" ? query : ""}
          onQuery={setQuery}
          onToggle={() => togglePick("recurso")}
          onSelect={(recursoId) => { onChange({ recurso: recursoId }); setOpen(null); setQuery("") }}
          onClear={() => onChange({ recurso: null })}
        />
      )}
      {(product || availableProducts.length > 0 || requiredProduct) && (
        <PickFilter
          required={requiredProduct}
          kind="produto"
          options={product ? produto.options : availableProducts}
          loading={product && produto.loading}
          error={product && produto.error}
          value={state.produto}
          open={open === "produto"}
          query={open === "produto" ? query : ""}
          onQuery={setQuery}
          onToggle={() => togglePick("produto")}
          onSelect={(produtoId) => { onChange({ produto: produtoId }); setOpen(null); setQuery("") }}
          onClear={() => onChange({ produto: null })}
        />
      )}
      <TypeSegment
        value={state.tipo}
        onSelect={(tipo) => { onChange({ tipo }); setOpen(null) }}
      />
    </>
  )

  const status = <p role="status" className="text-sm text-muted-foreground">{t("staffAgenda.applied", { count })}</p>
  const clearButton = count > 0 ? <Button type="button" variant="ghost" onClick={clear}>{t("staffAgenda.clear")}</Button> : null

  if (phone) {
    return (
      <section ref={modern ? rootRef : undefined} aria-label={t("staffAgenda.filters")} className={modern ? "border-b p-3" : "rounded-xl border bg-card p-3 text-card-foreground"}>
        <div className="flex flex-wrap items-center gap-2">
          {modern && search}
          <Button type="button" variant="outline" aria-expanded={panel} onClick={() => { setPanel((current) => !current); setOpen(null) }}>
            <Filter className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            {t("staffAgenda.filtersButton")}{modern && (panel ? " −" : " +")}
            {count > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{count}</span>}
          </Button>
          <ActiveChips state={state} recurso={recurso.options} produto={product ? produto.options : availableProducts} pedido={pedido.options} onChange={onChange} />
          {clearButton}
        </div>
        {panel && (
          <div ref={modern ? undefined : rootRef} className="mt-3 space-y-3 border-t pt-3">
            {controls}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {status}
              <Button type="button" variant="outline" onClick={() => setPanel(false)}>{t("staffAgenda.showAgenda")}</Button>
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section aria-label={t("staffAgenda.filters")} className={modern ? "border-b p-3" : "rounded-xl border bg-card px-3 py-3 text-card-foreground"}>
      <div ref={rootRef} role="group" aria-label={t("staffAgenda.filters")} className="flex flex-wrap items-center gap-2">
        {modern && search}
        {controls}
        {status}
        {clearButton}
      </div>
    </section>
  )
}

function ActiveChips({ state, recurso, produto, pedido, onChange }: {
  state: AgendaState
  recurso: AgendaOption[]
  produto: AgendaOption[]
  pedido: AgendaOption[]
  onChange: (patch: FilterPatch) => void
}) {
  const { t } = useTranslation()
  const chips: { key: keyof FilterPatch; label: string }[] = []
  if (state.recurso) chips.push({ key: "recurso", label: recurso.find((option) => option.id === state.recurso)?.label ?? state.recurso })
  if (state.produto) chips.push({ key: "produto", label: produto.find((option) => option.id === state.produto)?.label ?? state.produto })
  if (state.pedido) chips.push({ key: "pedido", label: pedido.find((option) => option.id === state.pedido)?.label ?? state.pedido })
  if (state.tipo) chips.push({ key: "tipo", label: t(`staffAgenda.types.${state.tipo}`) })
  return chips.map((chip) => (
    <span key={chip.key} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 text-sm">
      {chip.label}
      <button type="button" className="inline-flex size-6 items-center justify-center rounded-full hover:bg-muted" aria-label={t("staffAgenda.removeFilter", { label: chip.label })} onClick={() => onChange({ [chip.key]: null })}>
        <X className={ICON_SIZE.xs} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
      </button>
    </span>
  ))
}

function TypeSegment({ value, onSelect }: { value: AgendaState["tipo"]; onSelect: (value: AgendaState["tipo"]) => void }) {
  const { t } = useTranslation()
  const items = [{ id: null, label: t("staffAgenda.all") }, ...agendaTypes.map((id) => ({ id, label: t(`staffAgenda.types.${id}`) }))]
  return (
    <div role="group" aria-label={t("staffAgenda.tipo")} className="flex flex-row flex-wrap justify-start gap-1">
      {items.map((item) => (
        <Button key={item.id ?? "all"} type="button" className="min-h-11 rounded-full px-3" variant={value === item.id ? "default" : "outline"} aria-pressed={value === item.id} onClick={() => onSelect(item.id)}>
          {item.label}
        </Button>
      ))}
    </div>
  )
}

function optionLabel(options: AgendaOption[], value: string | null) {
  if (!value) return null
  return options.find((option) => option.id === value)?.label ?? value
}

function PickFilter({ required = false, kind, options, loading, error, value, open, query, onQuery, onToggle, onSelect, onClear }: {
  required?: boolean
  kind: "recurso" | "produto"
  options: AgendaOption[]
  loading: boolean
  error: boolean
  value: string | null
  open: boolean
  query: string
  onQuery: (value: string) => void
  onToggle: () => void
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const label = t(`staffAgenda.${kind}`)
  const selected = optionLabel(options, value)
  const shown = matching(options, query)
  return (
    <div className="relative" data-agenda-filter={kind}>
      <span className={`inline-flex min-h-11 items-center rounded-full border ${value ? "border-primary/40 bg-primary/10" : "border-border bg-background"}`}>
        <button type="button" className="inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium" aria-haspopup="listbox" aria-expanded={open} onClick={onToggle}>
          {selected ?? label}
          {!value && <Plus className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />}
        </button>
        {value && !required && (
          <button type="button" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted" aria-label={t("staffAgenda.removeFilter", { label: selected ?? label })} onClick={onClear}>
            <X className={ICON_SIZE.xs} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          </button>
        )}
      </span>
      {loading && <div role="status" aria-label={t("staffAgenda.loading", { label })} className="mt-2"><Skeleton variant="shimmer" className="h-11 w-28 rounded-full" /></div>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{t("staffAgenda.loadError", { label })}</p>}
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md">
          <label className="flex items-center gap-2 rounded-md border bg-background px-2">
            <Search className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
            <input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} aria-label={t(`staffAgenda.search.${kind}`)} placeholder={t(`staffAgenda.search.${kind}`)} className="h-11 w-full bg-transparent text-sm outline-none" />
          </label>
          <div role="listbox" aria-label={label} className="mt-2 max-h-60 overflow-y-auto">
            {shown.map((option) => (
              <button key={option.id} type="button" role="option" aria-selected={option.id === value} className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted" onClick={() => onSelect(option.id)}>
                {option.label}
              </button>
            ))}
            {shown.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t("staffAgenda.noResults", { query })}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function OrderSearch({ options, loading, error, value, open, query, onQuery, onOpen, onSelect, onClear }: {
  options: AgendaOption[]
  loading: boolean
  error: boolean
  value: string | null
  open: boolean
  query: string
  onQuery: (value: string) => void
  onOpen: () => void
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const label = t("staffAgenda.pedido")
  const selected = optionLabel(options, value)
  const shown = matching(options, query).slice(0, query.trim() ? 6 : 8)
  const listId = "agenda-order-results"
  return (
    <div className="relative min-w-64 flex-1">
      <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3">
        <Search className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        {selected && (
          <span className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full bg-primary/15 px-2 py-0.5 text-sm">
            <span className="truncate">{selected}</span>
            <button type="button" className="inline-flex size-6 items-center justify-center rounded-full hover:bg-muted" aria-label={t("staffAgenda.removeFilter", { label: selected })} onClick={onClear}>
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
          onFocus={onOpen}
          onChange={(event) => onQuery(event.target.value)}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {loading && <div role="status" aria-label={t("staffAgenda.loading", { label })} className="mt-2"><Skeleton variant="shimmer" className="h-11 w-40 rounded-full" /></div>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{t("staffAgenda.loadError", { label })}</p>}
      {open && (
        <div id={listId} role="listbox" aria-label={label} className="absolute left-0 top-full z-20 mt-1 w-full min-w-72 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md">
          {shown.map((option) => (
            <button key={option.id} type="button" role="option" aria-selected={option.id === value} className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted" onClick={() => onSelect(option.id)}>
              {option.label}
            </button>
          ))}
          {shown.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">{t("staffAgenda.noResults", { query })}</p>}
        </div>
      )}
    </div>
  )
}
