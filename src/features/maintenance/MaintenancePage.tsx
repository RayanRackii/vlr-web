import { useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useMaintenance, useMaintenanceList, type MaintenanceTab as Tab } from "./useMaintenance"
import "./maintenance.css"

export function MaintenancePage() {
  const { t } = useTranslation()
  const data = useMaintenance()
  const [params, setParams] = useSearchParams()
  const tabs: Tab[] = ["hoje", ...(data.access.orders ? ["ordens" as const] : []), ...(data.access.plans ? ["planos" as const] : [])]
  const requested = params.get("aba")
  const tab = tabs.find(value => value === requested) ?? "hoje"
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [kind, setKind] = useState("")
  const [mobileFilters, setMobileFilters] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const clear = () => { setSearch(""); setStatus(""); setKind("") }
  function selectTab(value: Tab) {
    const next = new URLSearchParams(params); next.set("aba", value); setParams(next); clear()
  }
  const { filtered, statusOptions } = useMaintenanceList(data, { tab, search, status, kind })
  const action = tab === "planos"
    ? data.access.createPlan ? { to: "/manutencao/planos/novo", label: t("maintenance.newPlan") } : null
    : data.access.createOrder ? { to: "/manutencao/ordens/nova", label: t("maintenance.newOrder") } : null
  return <div className="maintenance-page mx-auto min-w-0 space-y-5">
    <header className="space-y-1">
      <p className="maintenance-eyebrow">{t("maintenance.eyebrow")}</p>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("nav.manutencao")}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{t("maintenance.subtitle")}</p>
      <div role="tablist" aria-label={t("nav.manutencao")} className="maintenance-tabs">
        {tabs.map((value, index) => <button key={value} ref={node => { tabRefs.current[index] = node }} type="button" role="tab" id={`maintenance-tab-${value}`} aria-controls="maintenance-list" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => selectTab(value)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null
          if (next === null) return
          event.preventDefault(); selectTab(tabs[next]); tabRefs.current[next]?.focus()
        }}>{t(`maintenance.tabs.${value}`)}</button>)}
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-base font-semibold">{t(`maintenance.tabs.${tab}`)}</h2><p className="text-sm text-muted-foreground">{t(`maintenance.sections.${tab}`)}</p></div>
      <div className="flex flex-wrap items-center gap-3">
        {data.access.library && <Button variant="ghost" render={<Link to="/pmoc/biblioteca" />}>{t("nav.pmocLibrary")}</Button>}
        {action && <Button render={<Link to={action.to} />}>{action.label}</Button>}
      </div>
    </div>
    <section className="maintenance-card" id="maintenance-list" role="tabpanel" aria-labelledby={`maintenance-tab-${tab}`} aria-busy={data.loading}>
      <div className="maintenance-toolbar">
        <Input type="search" className="maintenance-search" aria-label={t("maintenance.search")} placeholder={t("maintenance.search")} value={search} onChange={event => setSearch(event.target.value)} />
        <Button variant="outline" className="maintenance-mobile-filter" aria-expanded={mobileFilters} aria-controls="maintenance-filters" onClick={() => setMobileFilters(value => !value)}>{t("maintenance.filters")} +</Button>
        <div id="maintenance-filters" className="maintenance-filters" data-expanded={mobileFilters}>
          <Popover><PopoverTrigger render={<Button variant="outline" className="min-h-11" />}>{t("maintenance.status")}{status ? `: ${statusOptions.find(([key]) => key === status)?.[1] ?? ""}` : ""} +</PopoverTrigger>
            <PopoverContent align="start"><div className="space-y-1" role="group" aria-label={t("maintenance.status")}>
              {[["", t("maintenance.allStatuses")], ...statusOptions].map(([key, label]) => <Button key={key} variant={status === key ? "secondary" : "ghost"} className="min-h-11 w-full justify-start" aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</Button>)}
            </div></PopoverContent>
          </Popover>
          {tab === "hoje" && <Popover><PopoverTrigger render={<Button variant="outline" className="min-h-11" />}>{t("maintenance.type")}{kind ? `: ${t(`maintenance.tabs.${kind}`)}` : ""} +</PopoverTrigger>
            <PopoverContent align="start"><div className="space-y-1" role="group" aria-label={t("maintenance.type")}>
              {[["", t("maintenance.allTypes")], ...tabs.filter(value => value !== "hoje").map(value => [value, t(`maintenance.tabs.${value}`)])].map(([value, label]) => <Button key={value} variant={kind === value ? "secondary" : "ghost"} className="min-h-11 w-full justify-start" aria-pressed={kind === value} onClick={() => setKind(value)}>{label}</Button>)}
            </div></PopoverContent>
          </Popover>}
        </div>
      </div>
      {data.errors.length > 0 && <div role="alert" className="space-y-2 p-4 text-sm text-destructive">{data.errors.map((error, index) => <p key={index}>{error}</p>)}<Button variant="outline" onClick={data.retry}>{t("catalog.retry")}</Button></div>}
      {data.loading ? <p role="status" className="p-6 text-sm text-muted-foreground">{t("maintenance.loading")}</p> : filtered.length ? <ul className="divide-y divide-border">
        {filtered.map(row => <li key={row.id} className="maintenance-row">
          <Link to={row.to} className="min-w-0 flex-1 rounded-sm"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{row.title}</span><span className="maintenance-badge">{row.statusLabel}</span></div><p className="mt-1 text-xs text-muted-foreground">{row.description}</p></Link>
          {row.generate && <Button variant="outline" render={<Link to={row.generate} />}>{t("maintenance.generate")}</Button>}
        </li>)}
      </ul> : data.errors.length === 0 && <div className="space-y-2 p-8 text-center" role="status"><h2 className="text-base font-semibold">{t("maintenance.emptyTitle")}</h2><p className="text-sm text-muted-foreground">{t("maintenance.emptyDescription")}</p>{(search || status || kind) ? <Button variant="outline" onClick={clear}>{t("maintenance.clear")}</Button> : action && <Button variant="outline" render={<Link to={action.to} />}>{action.label}</Button>}</div>}
    </section>
  </div>
}
