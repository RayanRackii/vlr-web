import { useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePedidos } from "../hooks/usePedidos"
import { formatCatalogDate } from "../schemas/catalogSchemas"
import { formatOrderTotalText } from "../lib/catalogPriceSummary"
import { STAFF_ORDER_STATUS_TONE } from "../lib/catalogStatusBadge"
import "./pedidos.css"

type Tab = "todos" | "pedidos" | "solicitacoes"
export function PedidosPage() {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const data = usePedidos()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [mobileFilters, setMobileFilters] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabs: Tab[] = ["todos", ...(data.ordersAllowed ? ["pedidos" as const] : []), ...(data.requestsAllowed ? ["solicitacoes" as const] : [])]
  const requestedTab = params.get("aba")
  const tab = tabs.find(value => value === requestedTab) ?? "todos"
  function selectTab(value: Tab) {
    setParams(previous => { previous.set("aba", value); return previous })
    setStatus("")
  }
  const rows = [
    ...(tab !== "solicitacoes" ? data.orders.map(order => ({
      id: `order:${order.id}`, to: `/pedidos/${order.id}`, title: order.displayNumber,
      status: `order:${order.status}`, statusLabel: t(`catalog.status.${order.status}`), tone: STAFF_ORDER_STATUS_TONE[order.status], date: order.createdAt,
      description: [order.customerName, formatOrderTotalText(order, i18n.language, { onRequest: t("catalog.priceOnRequest"), partial: amount => t("catalog.knownPlusOnRequest", { amount }) }), formatCatalogDate(order.createdAt, i18n.language, timeZone), order.productionSummary !== "NotRequired" ? t(`catalog.resourcePlanning.productionSummary.status.${order.productionSummary}`) : null],
    })) : []),
    ...(tab !== "pedidos" ? data.requests.map(request => ({
      id: `request:${request.id}`, to: `/pedidos/solicitacoes/${request.id}`, title: request.description,
      status: `request:${request.status}`, statusLabel: t(`catalog.productRequestStatus.${request.status}`), tone: request.status === "Cancelled" ? "danger" : "info", date: request.createdAt,
      description: [t("pedidos.tabs.solicitacoes"), t("pedidos.quantity", { count: request.quantity }), request.note, formatCatalogDate(request.createdAt, i18n.language, timeZone)],
    })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const statusOptions = [...new Map(rows.map(row => [row.status, row.statusLabel])).entries()]
  const query = search.trim().toLocaleLowerCase(i18n.language)
  const filtered = rows.filter(row => (!status || row.status === status) && [row.title, row.statusLabel, ...row.description].filter(Boolean).join(" ").toLocaleLowerCase(i18n.language).includes(query))
  const clear = () => { setSearch(""); setStatus("") }
  return <div className="pedidos-page mx-auto min-w-0 space-y-5">
    <header className="space-y-1">
      <p className="pedidos-eyebrow">{t("pedidos.eyebrow")}</p>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("nav.pedidos")}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{t("pedidos.subtitle")}</p>
      <div role="tablist" aria-label={t("pedidos.type")} className="pedidos-tabs">
        {tabs.map((value, index) => <button key={value} ref={node => { tabRefs.current[index] = node }} type="button" role="tab" id={`pedidos-tab-${value}`} aria-controls="pedidos-list" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null
          if (next === null) return
          event.preventDefault(); selectTab(tabs[next]); tabRefs.current[next]?.focus()
        }}>{t(`pedidos.tabs.${value}`)}</button>)}
      </div>
    </header>
    <section className="pedidos-card" id="pedidos-list" role="tabpanel" aria-labelledby={`pedidos-tab-${tab}`} aria-busy={data.loading}>
      <div className="pedidos-toolbar">
        <Input type="search" className="pedidos-search" aria-label={t("pedidos.search")} placeholder={t("pedidos.search")} value={search} onChange={event => setSearch(event.target.value)} />
        <Button variant="outline" className="pedidos-mobile-filter" aria-expanded={mobileFilters} aria-controls="pedidos-filters" onClick={() => setMobileFilters(value => !value)}>{t("pedidos.filters")} +</Button>
        <div id="pedidos-filters" className="pedidos-filters" data-expanded={mobileFilters}>
          <Popover><PopoverTrigger render={<Button variant="outline" className="min-h-11" />} >{t("pedidos.status")}{status ? `: ${statusOptions.find(([key]) => key === status)?.[1] ?? ""}` : ""} +</PopoverTrigger>
            <PopoverContent align="start"><div className="space-y-1" role="group" aria-label={t("pedidos.status")}>
              {[["", t("pedidos.allStatuses")], ...statusOptions].map(([key, label]) => <Button key={key} variant={status === key ? "secondary" : "ghost"} className="min-h-11 w-full justify-start" aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</Button>)}
            </div></PopoverContent>
          </Popover>
        </div>
      </div>
      {data.errors.length > 0 && <div role="alert" className="space-y-2 p-4 text-sm text-destructive">{data.errors.map((error, index) => <p key={index}>{error}</p>)}<Button variant="outline" onClick={data.retry}>{t("catalog.retry")}</Button></div>}
      {data.loading ? <p role="status" className="p-6 text-sm text-muted-foreground">{t("pedidos.loading")}</p> : filtered.length ? <ul className="divide-y divide-border">
        {filtered.map(row => <li key={row.id}><Link to={row.to} className="pedidos-row">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{row.title}</span><span className="pedidos-badge" data-tone={row.tone}>{row.statusLabel}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{row.description.filter(Boolean).join(" · ")}</p>
        </Link></li>)}
      </ul> : data.errors.length === 0 && <div className="space-y-2 p-8 text-center" role="status"><h2 className="text-base font-semibold">{t("pedidos.emptyTitle")}</h2><p className="text-sm text-muted-foreground">{t("pedidos.emptyDescription")}</p>{(search || status) && <Button variant="outline" onClick={clear}>{t("pedidos.clear")}</Button>}</div>}
    </section>
  </div>
}
