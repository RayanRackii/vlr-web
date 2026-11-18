import { useState } from "react"
import { ChevronDown, Package, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ICON_SIZE, ICON_STROKE_WIDTH } from "@/lib/icon"
import { activeFilterCount, fold, clearPatch, groupResources, selectedResourceIds, useIsMedium, type AgendaFilterPatch, type AgendaResource } from "./agendaFilterModel"
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
  const checked = selectedResourceIds(state.recursos, resources)
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

const PRODUCT_ALL = "__all__"

/** Body shared by the Popover and the small-screen Sheet. */
export function AgendaFilterFields(props: AgendaFilterFieldsProps) {
  const { t } = useTranslation()
  const { state, showResources, showProducts, products, productsLoading, productsError, requiredProduct, onChange } = props
  const productItems = [
    ...(requiredProduct ? [] : [{ value: PRODUCT_ALL, label: t("agendas.filters.allProducts") }]),
    ...products.map((product) => ({ value: product.id, label: product.label })),
  ]
  return (
    <div className="space-y-5">
      {showResources && <ResourceTree state={state} resources={props.resources} onChange={onChange} />}
      {(showProducts || requiredProduct) && (
        <div className="space-y-2">
          <Label id="agenda-product-filter-label" className="block text-sm font-semibold">{t("agendas.filters.product")}</Label>
          <Select modal={false} value={state.produto ?? (requiredProduct ? null : PRODUCT_ALL)} items={productItems} disabled={productsLoading} onValueChange={(value) => onChange({ produto: value === null || value === PRODUCT_ALL ? null : value })}>
            <SelectTrigger id="agenda-product-filter" aria-labelledby="agenda-product-filter-label" icon={Package}>
              <SelectValue placeholder={t("agendas.filters.pickProduct")} />
            </SelectTrigger>
            <SelectContent>
              {productItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
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

/**
 * The "N recursos selecionados" button of the info row. From `md` it opens a Popover with the
 * resource tree and filters; below `md` the same content opens in a bottom Sheet.
 */
export function AgendaFilterMenu(props: AgendaFilterFieldsProps) {
  const { t } = useTranslation()
  const medium = useIsMedium()
  const count = activeFilterCount(props.state)
  const selected = selectedResourceIds(props.state.recursos, props.resources).size
  const label = props.showResources ? t("agendas.filters.selected", { count: selected }) : t("agendas.filters.title")
  const trigger = (
    <>
      <span className="truncate">{label}</span>
      <CountBadge count={count} />
      <ChevronDown className={ICON_SIZE.sm} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
    </>
  )
  const triggerClass = "touch-target -ml-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-muted"
  if (medium) {
    return (
      <Popover>
        <PopoverTrigger className={triggerClass}>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="max-h-[min(40rem,var(--available-height,70vh))] w-96 gap-4 overflow-y-auto p-4" aria-label={t("agendas.filters.title")}>
          <AgendaFilterFields {...props} />
        </PopoverContent>
      </Popover>
    )
  }
  return (
    <Sheet>
      <SheetTrigger className={triggerClass}>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>{t("agendas.filters.title")}</SheetTitle>
          <SheetDescription>{t("agendas.filters.sheetDescription")}</SheetDescription>
        </SheetHeader>
        <AgendaFilterFields {...props} />
      </SheetContent>
    </Sheet>
  )
}
