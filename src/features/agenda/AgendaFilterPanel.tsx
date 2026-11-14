import { useState } from "react"
import { Filter, PanelLeftClose, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { activeFilterCount, fold, clearPatch, groupResources, readCollapsed, writeCollapsed, type AgendaFilterPatch, type AgendaResource } from "./agendaFilterModel"
import type { AgendaOption } from "./useAgendaOptions"
import type { AgendaState } from "./urlState"

export type AgendaFilterFieldsProps = {
  state: AgendaState
  resources: AgendaResource[]
  /** Hidden without rental read access. */
  showResources: boolean
  showProducts: boolean
  products: AgendaOption[]
  productsLoading?: boolean
  productsError?: boolean
  /** The product view cannot show all products. */
  requiredProduct: boolean
  onChange: (patch: AgendaFilterPatch) => void
}

function ResourceTree({ state, resources, onChange }: Pick<AgendaFilterFieldsProps, "state" | "resources" | "onChange">) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  // `recursos` empty = every resource; a stored id may also be a legacy category id.
  const byCategory = (id: string) => resources.filter((resource) => resource.categoryId === id).map((resource) => resource.id)
  const stored = new Set(state.recursos.flatMap((id) => (resources.some((resource) => resource.id === id) ? [id] : byCategory(id))))
  const checked = state.recursos.length === 0 ? new Set(resources.map((resource) => resource.id)) : stored
  const total = resources.length
  const needle = fold(query.trim())
  const visible = resources.filter((resource) => !needle || fold(resource.name).includes(needle))
  const groups = groupResources(visible, t("agendas.filters.noCategory"))

  // Everything checked is stored as an empty list, and so is an empty selection (never "show nothing").
  const commit = (next: Set<string>) => onChange({ recursos: next.size === 0 || next.size === total ? [] : [...next] })
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(checked)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    commit(next)
  }

  return (
    <section aria-label={t("agendas.filters.resourcesList")} className="space-y-2">
      <h3 className="text-sm font-semibold">{t("agendas.filters.resources", { selected: checked.size, total })}</h3>
      <Label className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-3">
        <Search className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("staffAgenda.search.recurso")}
          placeholder={t("staffAgenda.search.recurso")}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </Label>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {groups.map((group) => {
          const ids = group.resources.map((resource) => resource.id)
          const selected = ids.filter((id) => checked.has(id)).length
          return (
            <div key={group.key} role="group" aria-label={group.name}>
              <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
                <Checkbox
                  aria-label={t("agendas.filters.group", { name: group.name })}
                  checked={selected === ids.length}
                  ref={(element) => { if (element) element.indeterminate = selected > 0 && selected < ids.length }}
                  onChange={(event) => toggle(ids, event.target.checked)}
                />
                {group.name}
              </Label>
              {group.resources.map((resource) => (
                <Label key={resource.id} className="flex min-h-11 cursor-pointer items-center gap-2 pl-6 text-sm">
                  <Checkbox checked={checked.has(resource.id)} onChange={(event) => toggle([resource.id], event.target.checked)} />
                  {resource.name}
                </Label>
              ))}
            </div>
          )
        })}
        {groups.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t("agendas.filters.noResources")}</p>}
      </div>
    </section>
  )
}

/** Body shared by the desktop panel and the small-screen Sheet. */
export function AgendaFilterFields(props: AgendaFilterFieldsProps) {
  const { t } = useTranslation()
  const { state, showResources, showProducts, products, productsLoading, productsError, requiredProduct, onChange } = props
  return (
    <div className="space-y-5">
      {showResources && <ResourceTree state={state} resources={props.resources} onChange={onChange} />}
      {(showProducts || requiredProduct) && (
        <div className="space-y-2">
          <Label htmlFor="agenda-product-filter" className="block text-sm font-semibold">{t("agendas.filters.product")}</Label>
          <select
            id="agenda-product-filter"
            value={state.produto ?? ""}
            disabled={productsLoading}
            onChange={(event) => onChange({ produto: event.target.value || null })}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {requiredProduct ? <option value="" disabled>{t("agendas.filters.pickProduct")}</option> : <option value="">{t("agendas.filters.allProducts")}</option>}
            {products.map((product) => <option key={product.id} value={product.id}>{product.label}</option>)}
          </select>
          {productsError && <p role="alert" className="text-sm text-destructive">{t("staffAgenda.loadError", { label: t("agendas.filters.product") })}</p>}
        </div>
      )}
      <fieldset className="space-y-1">
        <legend className="text-sm font-semibold">{t("agendas.filters.options")}</legend>
        <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={state.livres} onChange={(event) => onChange({ livres: event.target.checked })} />
          {t("agendas.filters.onlyFree")}
        </Label>
        <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={state.fechadas} onChange={(event) => onChange({ fechadas: event.target.checked })} />
          {t("agendas.filters.showClosed")}
        </Label>
      </fieldset>
      {activeFilterCount(state) > 0 && (
        <Button type="button" variant="outline" className="touch-target min-h-11 w-full" onClick={() => onChange(clearPatch)}>
          {t("agendas.filters.clear")}
        </Button>
      )}
    </div>
  )
}

function CountBadge({ count }: { count: number }) {
  return count > 0 ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{count}</span> : null
}

/** Left panel from `lg`: collapsible to an icon rail, the choice is remembered per viewer. */
export function AgendaFilterPanel(props: AgendaFilterFieldsProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const count = activeFilterCount(props.state)
  const set = (value: boolean) => { setCollapsed(value); writeCollapsed(value) }

  if (collapsed) {
    return (
      <aside aria-label={t("agendas.filters.title")} className="shrink-0">
        <Button type="button" variant="outline" size="icon" className="touch-target relative size-11" aria-label={t("agendas.filters.open")} aria-expanded={false} onClick={() => set(false)}>
          <Filter className={ICON_SIZE.md} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          {count > 0 && <span className="absolute -right-1 -top-1"><CountBadge count={count} /></span>}
        </Button>
      </aside>
    )
  }
  return (
    <aside aria-label={t("agendas.filters.title")} className="w-72 shrink-0 space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {t("agendas.filters.title")}
          <CountBadge count={count} />
        </h2>
        <Button type="button" variant="ghost" size="icon" className="touch-target size-11" aria-label={t("agendas.filters.collapse")} aria-expanded onClick={() => set(true)}>
          <PanelLeftClose className={ICON_SIZE.md} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        </Button>
      </div>
      <AgendaFilterFields {...props} />
    </aside>
  )
}

/** "Filtros" button + Sheet used below `lg`. */
export function AgendaFilterSheet(props: AgendaFilterFieldsProps) {
  const { t } = useTranslation()
  return (
    <Sheet>
      <SheetTrigger render={<Button type="button" variant="outline" className="touch-target min-h-11" />}>
        <Filter className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
        {t("agendas.filters.title")}
        <CountBadge count={activeFilterCount(props.state)} />
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t("agendas.filters.title")}</SheetTitle>
          <SheetDescription>{t("agendas.filters.sheetDescription")}</SheetDescription>
        </SheetHeader>
        <AgendaFilterFields {...props} />
      </SheetContent>
    </Sheet>
  )
}
