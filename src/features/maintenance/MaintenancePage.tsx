import { useMemo, useState, type ReactNode } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Page } from "@/components/layout/Page"
import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { StatusChips } from "@/components/data-table/StatusChips"
import { StatusBadge } from "@/components/ui/status"
import type { StatusTone } from "@/components/ui/status-tones"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { tenantTodayIsoDate } from "@/lib/tenantTimeZone"
import { generateWorkOrderFromPlan, isDuplicateWorkOrderError } from "@/features/workOrders/services/workOrdersService"
import type { MaintenancePlan } from "@/features/pmoc/schemas/maintenancePlanSchemas"
import type { WorkOrder } from "@/features/workOrders/schemas/workOrderSchemas"
import { buildAgendaRows, formatHumanDate, nextDueByPlan, type AgendaFilter, type AgendaRow, type AgendaSection } from "./agendaModel"
import { useMaintenance, type MaintenanceTab as Tab } from "./useMaintenance"
import "./maintenance.css"

const SECTIONS: AgendaSection[] = ["overdue", "week", "upcoming"]
const ORDER_TONE: Record<string, StatusTone> = { Pending: "info", Scheduled: "info", InProgress: "progress", Completed: "success", Canceled: "neutral" }

function Equipment({ name, tag, to }: { name: string; tag: string; to?: string }) {
  const body = <><span className="font-medium">{name}</span> <span className="text-xs text-muted-foreground">{tag}</span></>
  return to ? <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 rounded-sm hover:underline">{body}</Link> : <span className="inline-flex items-center gap-1.5">{body}</span>
}

export function MaintenancePage() {
  const { t, i18n } = useTranslation()
  const data = useMaintenance()
  const timeZone = useTenantTimeZone()
  const today = tenantTodayIsoDate(timeZone)
  const [params, setParams] = useSearchParams()
  const tabs: Tab[] = ["agenda", ...(data.access.orders ? ["ordens" as const] : []), ...(data.access.plans ? ["planos" as const] : [])]
  const requested = params.get("aba")
  const tab = tabs.find(value => value === (requested === "hoje" ? "agenda" : requested)) ?? "agenda"
  const [search, setSearch] = useState("")
  const [chip, setChip] = useState<string | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const date = (value: string) => formatHumanDate(value, i18n.language)
  const query = search.trim().toLocaleLowerCase(i18n.language)
  const matches = (...parts: (string | null | undefined)[]) => !query || parts.filter(Boolean).join(" ").toLocaleLowerCase(i18n.language).includes(query)
  function selectTab(value: Tab) {
    const next = new URLSearchParams(params); next.set("aba", value); setParams(next); setSearch(""); setChip(null)
  }
  const agendaRows = useMemo(() => buildAgendaRows({ orders: data.orders, plans: data.plans, coverage: data.coverage }, today), [data.orders, data.plans, data.coverage, today])
  const nextDue = useMemo(() => nextDueByPlan(data.coverage), [data.coverage])
  const overdueNeeds = agendaRows.filter(row => row.kind === "need" && row.section === "overdue")
  const userId = data.access.userId
  const agendaChip = (row: AgendaRow, filter: AgendaFilter) => filter === "overdue" ? row.section === "overdue" : filter === "unassigned" ? row.kind === "order" && !row.assignedUserId : row.kind === "order" && !!userId && row.assignedUserId === userId
  const agendaCount = (filter: AgendaFilter) => agendaRows.filter(row => agendaChip(row, filter)).length
  const agendaFiltered = agendaRows.filter(row => (!chip || agendaChip(row, chip as AgendaFilter)) && matches(row.assetName, row.assetTag, row.planName, row.technician))
  const action = tab === "planos"
    ? data.access.createPlan ? { to: "/manutencao/planos/novo", label: t("maintenance.newPlan") } : null
    : data.access.createOrder ? { to: "/manutencao/ordens/nova", label: t("maintenance.newOrder") } : null

  async function generateOverdue() {
    setConfirmBulk(false)
    const targets = overdueNeeds.filter(row => row.planId)
    let created = 0, skipped = 0, failed = 0
    setProgress({ done: 0, total: targets.length })
    for (const [index, row] of targets.entries()) {
      try { await generateWorkOrderFromPlan({ planId: row.planId as string, assetId: row.assetId, assignedUserId: null, scheduledDate: today }); created += 1 }
      catch (error: unknown) { if (isDuplicateWorkOrderError(error)) skipped += 1; else failed += 1 }
      setProgress({ done: index + 1, total: targets.length })
    }
    setProgress(null)
    const summary = t("maintenance.bulkSummary", { created, skipped, failed })
    if (failed > 0) toast.error(summary); else toast.success(summary)
    data.retry()
  }

  const loading = data.loading || (tab === "agenda" && data.coverageLoading)
  const state = loading ? "loading" as const : "ready" as const
  const emptyBase = { title: t("maintenance.emptyTitle"), description: t("maintenance.emptyDescription") }
  const emptyAction = (search || chip) ? <Button variant="outline" onClick={() => { setSearch(""); setChip(null) }}>{t("maintenance.clear")}</Button> : action ? <Button variant="outline" render={<Link to={action.to} />}>{action.label}</Button> : undefined

  const overdueBadge = (row: AgendaRow) => row.section === "overdue" ? <StatusBadge tone="danger">{t("maintenance.overdueDays", { count: row.daysLate })}</StatusBadge> : null
  const generateLink = (row: AgendaRow) => row.kind === "need" && data.access.createOrder ? <Button variant="outline" render={<Link to={`/manutencao/ordens/nova?plano=${row.planId}`} />}>{t("maintenance.generate")}</Button> : null
  const agendaColumns: DataListColumn<AgendaRow>[] = [
    { id: "equipment", header: t("maintenance.columns.equipment"), cell: row => <Equipment name={row.assetName} tag={row.assetTag} to={row.to} /> },
    { id: "plan", header: t("maintenance.columns.plan"), cell: row => row.planName ?? "—", hideBelow: "lg" },
    { id: "technician", header: t("maintenance.columns.technician"), cell: row => row.kind === "need" ? "—" : row.technician ?? <span className="text-muted-foreground">{t("maintenance.noTechnician")}</span>, hideBelow: "lg" },
    { id: "date", header: t("maintenance.columns.date"), cell: row => <span className="flex flex-wrap items-center gap-2">{date(row.date)}{overdueBadge(row)}</span> },
    { id: "status", header: t("maintenance.columns.status"), cell: row => row.kind === "need" ? <StatusBadge tone="warning">{t("maintenance.needsOrder")}</StatusBadge> : <StatusBadge tone={ORDER_TONE[row.status] ?? "neutral"}>{t(`workOrders.status.${row.status}`)}</StatusBadge> },
    { id: "action", header: <span className="sr-only">{t("maintenance.columns.action")}</span>, align: "end", cell: generateLink },
  ]
  const agendaCard = (row: AgendaRow) => <div className="space-y-2 text-sm">
    <Equipment name={row.assetName} tag={row.assetTag} to={row.to} />
    {row.planName && <p className="text-muted-foreground">{row.planName}</p>}
    <p className="text-muted-foreground">{row.kind === "need" ? t("maintenance.needsOrder") : row.technician ?? t("maintenance.noTechnician")}</p>
    <div className="flex flex-wrap items-center gap-2">{date(row.date)}{overdueBadge(row)}
      {row.kind === "order" && <StatusBadge tone={ORDER_TONE[row.status] ?? "neutral"}>{t(`workOrders.status.${row.status}`)}</StatusBadge>}</div>
    {generateLink(row)}
  </div>

  const orderRows = data.orders.filter(order => (!chip || order.status === chip) && matches(order.asset.name, order.asset.tag, order.sourcePlanName, order.assignedUser?.fullName)).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
  const orderBadge = (order: WorkOrder) => <StatusBadge tone={ORDER_TONE[order.status] ?? "neutral"}>{t(`workOrders.status.${order.status}`)}</StatusBadge>
  const orderColumns: DataListColumn<WorkOrder>[] = [
    { id: "equipment", header: t("maintenance.columns.equipment"), cell: order => <Equipment name={order.asset.name} tag={order.asset.tag} to={`/os/${order.id}`} /> },
    { id: "plan", header: t("maintenance.columns.plan"), cell: order => order.sourcePlanName ?? "—", hideBelow: "lg" },
    { id: "technician", header: t("maintenance.columns.technician"), cell: order => order.assignedUser?.fullName ?? <span className="text-muted-foreground">{t("maintenance.noTechnician")}</span> },
    { id: "date", header: t("maintenance.columns.date"), cell: order => date(order.scheduledDate) },
    { id: "status", header: t("maintenance.columns.status"), cell: orderBadge },
  ]
  const orderStatuses = [...new Set(data.orders.map(order => order.status))]

  const planRows = data.plans.filter(plan => (!chip || (chip === "active") === plan.isActive) && matches(plan.name, plan.description)).sort((a, b) => a.name.localeCompare(b.name))
  const planBadges = (plan: MaintenancePlan) => <span className="flex flex-wrap items-center gap-2">
    <StatusBadge tone={plan.isActive ? "success" : "neutral"}>{t(`pmoc.plans.status.${plan.isActive ? "active" : "inactive"}`)}</StatusBadge>
    {plan.autoGenerateEnabled && <StatusBadge tone="info">{t("maintenance.auto")}</StatusBadge>}</span>
  const planNext = (plan: MaintenancePlan) => { const value = plan.isActive ? nextDue[plan.id] : undefined; return value ? date(value) : "—" }
  const planColumns: DataListColumn<MaintenancePlan>[] = [
    { id: "name", header: t("maintenance.columns.plan"), cell: plan => <Link to={`/pmoc/${plan.id}`} className="inline-flex min-h-11 items-center rounded-sm font-medium hover:underline">{plan.name}</Link> },
    { id: "interval", header: t("maintenance.columns.frequency"), cell: plan => t("maintenance.every", { count: plan.intervalDays }) },
    { id: "next", header: t("maintenance.columns.nextDue"), cell: planNext },
    { id: "status", header: t("maintenance.columns.status"), cell: planBadges },
  ]

  const all = t("maintenance.agendaFilters.all")
  const chipsGroup = tab === "agenda"
    ? <StatusChips<AgendaFilter> label={t("maintenance.agendaFilters.label")} allLabel={all} allCount={agendaRows.length} value={chip as AgendaFilter | null} onChange={setChip}
        options={[
          { value: "overdue", label: t("maintenance.agendaFilters.overdue"), tone: "danger", count: agendaCount("overdue") },
          { value: "unassigned", label: t("maintenance.agendaFilters.unassigned"), count: agendaCount("unassigned") },
          ...(userId ? [{ value: "mine" as const, label: t("maintenance.agendaFilters.mine"), count: agendaCount("mine") }] : []),
        ]} />
    : tab === "ordens"
      ? <StatusChips label={t("maintenance.status")} allLabel={all} value={chip} onChange={setChip} options={orderStatuses.map(value => ({ value, label: t(`workOrders.status.${value}`), tone: ORDER_TONE[value] ?? "neutral" }))} />
      : <StatusChips label={t("maintenance.status")} allLabel={all} value={chip} onChange={setChip} options={[{ value: "active", label: t("pmoc.plans.status.active"), tone: "success" }, { value: "inactive", label: t("pmoc.plans.status.inactive"), tone: "neutral" }]} />

  const common = { state, loadingLabel: t("maintenance.loading") } as const
  let body: ReactNode
  if (tab === "agenda") {
    const visible = SECTIONS.filter(section => agendaFiltered.some(row => row.section === section))
    body = loading || visible.length === 0
      ? <DataList<AgendaRow> label={t("maintenance.tabs.agenda")} columns={agendaColumns} rows={[]} getRowId={row => row.id} renderCard={agendaCard} empty={{ ...emptyBase, action: emptyAction }} {...common} />
      : <div className="space-y-5">{visible.map(section => <DataList<AgendaRow> key={section} label={t(`maintenance.sections.${section}`)} heading={<h2 className="text-sm font-semibold text-foreground">{t(`maintenance.sections.${section}`)}</h2>}
          columns={agendaColumns} rows={agendaFiltered.filter(row => row.section === section)} getRowId={row => row.id} renderCard={agendaCard} empty={emptyBase} />)}</div>
  } else if (tab === "ordens") {
    body = <DataList<WorkOrder> label={t("maintenance.tabs.ordens")} columns={orderColumns} rows={orderRows} getRowId={order => order.id}
      renderCard={order => <div className="space-y-2 text-sm"><Equipment name={order.asset.name} tag={order.asset.tag} to={`/os/${order.id}`} /><p className="text-muted-foreground">{order.assignedUser?.fullName ?? t("maintenance.noTechnician")}</p><div className="flex flex-wrap items-center gap-2">{date(order.scheduledDate)}{orderBadge(order)}</div></div>}
      empty={{ ...emptyBase, action: emptyAction }} {...common} />
  } else {
    body = <DataList<MaintenancePlan> label={t("maintenance.tabs.planos")} columns={planColumns} rows={planRows} getRowId={plan => plan.id}
      renderCard={plan => <div className="space-y-2 text-sm"><Link to={`/pmoc/${plan.id}`} className="inline-flex min-h-11 items-center font-medium">{plan.name}</Link><p className="text-muted-foreground">{t("maintenance.every", { count: plan.intervalDays })} · {t("maintenance.columns.nextDue")}: {planNext(plan)}</p>{planBadges(plan)}</div>}
      empty={{ ...emptyBase, action: emptyAction }} {...common} />
  }

  const bulk = tab === "agenda" && data.access.createOrder && overdueNeeds.length > 0
    ? <Button variant="outline" disabled={!!progress} onClick={() => setConfirmBulk(true)}>{progress ? t("maintenance.generating", progress) : t("maintenance.generateOverdue", { count: overdueNeeds.length })}</Button> : null

  return <Page header={{
    title: t("nav.manutencao"), description: t("maintenance.subtitle"),
    actions: <div className="flex flex-wrap items-center gap-3">
      {data.access.library && <Button variant="ghost" render={<Link to="/pmoc/biblioteca" />}>{t("nav.pmocLibrary")}</Button>}
      {bulk}
      {action && <Button render={<Link to={action.to} />}>{action.label}</Button>}
    </div>,
  }}>
    <Tabs value={tab} onValueChange={value => selectTab(value as Tab)}>
      <TabsList variant="line" activateOnFocus aria-label={t("nav.manutencao")}>
        {tabs.map(value => <TabsTrigger key={value} value={value} id={`maintenance-tab-${value}`} aria-controls="maintenance-list">{t(`maintenance.tabs.${value}`)}</TabsTrigger>)}
      </TabsList>
    </Tabs>
    <div id="maintenance-list" role="tabpanel" aria-labelledby={`maintenance-tab-${tab}`} aria-busy={data.loading} className="space-y-3">
      <FilterBar label={t("maintenance.filters")} search={{ value: search, onChange: setSearch, placeholder: t("maintenance.search"), label: t("maintenance.search") }} filters={chipsGroup} />
      {data.errors.length > 0 && <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{data.errors.map((error, index) => <p key={index}>{error}</p>)}<Button variant="outline" onClick={data.retry}>{t("catalog.retry")}</Button></div>}
      {tab === "agenda" && data.coverageFailed > 0 && <p role="status" className="text-sm text-muted-foreground">{t("maintenance.coverageFailed", { count: data.coverageFailed })}</p>}
      {body}
    </div>
    <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t("maintenance.bulkTitle", { count: overdueNeeds.length })}</AlertDialogTitle><AlertDialogDescription>{t("maintenance.bulkDescription")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel /><AlertDialogAction onClick={() => void generateOverdue()}>{t("maintenance.generate")}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Page>
}
