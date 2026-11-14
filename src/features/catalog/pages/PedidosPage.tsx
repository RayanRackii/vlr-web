import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { DataList, type DataListColumn } from "@/components/data-table/DataList"
import { FilterBar } from "@/components/data-table/FilterBar"
import { FilterTabs } from "@/components/data-table/FilterTabs"
import { StatusChips } from "@/components/data-table/StatusChips"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status"
import type { StatusTone } from "@/components/ui/status-tones"
import { useTenantTimeZone } from "@/contexts/TenantTimeZoneContext"
import { usePedidos } from "../hooks/usePedidos"
import { formatCatalogDate } from "../schemas/catalogSchemas"
import { formatOrderTotalText } from "../lib/catalogPriceSummary"
import { STAFF_ORDER_STATUS_TONE } from "../lib/catalogStatusBadge"

type Tab = "todos" | "pedidos" | "solicitacoes"
type TabFilter = Exclude<Tab, "todos">
type Row = {
  id: string
  to: string
  title: string
  status: string
  statusLabel: string
  tone: StatusTone
  date: string
  dateLabel: string
  customer: string
  total: string
  note: string | null
}

const DASH = "—"

function toStatusTone(tone: string): StatusTone {
  return tone === "muted" ? "neutral" : (tone as StatusTone)
}

export function PedidosPage() {
  const { t, i18n } = useTranslation()
  const timeZone = useTenantTimeZone()
  const data = usePedidos()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const tabs: Tab[] = ["todos", ...(data.ordersAllowed ? ["pedidos" as const] : []), ...(data.requestsAllowed ? ["solicitacoes" as const] : [])]
  const requestedTab = params.get("aba")
  const tab = tabs.find(value => value === requestedTab) ?? "todos"
  function selectTab(value: Tab) {
    setParams(previous => { previous.set("aba", value); return previous })
    setStatus(null)
  }
  const rows: Row[] = [
    ...(tab !== "solicitacoes" ? data.orders.map((order): Row => ({
      id: `order:${order.id}`, to: `/pedidos/${order.id}`, title: order.displayNumber,
      status: `order:${order.status}`, statusLabel: t(`catalog.status.${order.status}`), tone: toStatusTone(STAFF_ORDER_STATUS_TONE[order.status]),
      date: order.createdAt, dateLabel: formatCatalogDate(order.createdAt, i18n.language, timeZone),
      customer: order.customerName,
      total: formatOrderTotalText(order, i18n.language, { onRequest: t("catalog.priceOnRequest"), partial: amount => t("catalog.knownPlusOnRequest", { amount }) }),
      note: order.productionSummary !== "NotRequired" ? t(`catalog.resourcePlanning.productionSummary.status.${order.productionSummary}`) : null,
    })) : []),
    ...(tab !== "pedidos" ? data.requests.map((request): Row => ({
      id: `request:${request.id}`, to: `/pedidos/solicitacoes/${request.id}`, title: request.description,
      status: `request:${request.status}`, statusLabel: t(`catalog.productRequestStatus.${request.status}`), tone: request.status === "Cancelled" ? "danger" : "info",
      date: request.createdAt, dateLabel: formatCatalogDate(request.createdAt, i18n.language, timeZone),
      customer: DASH, total: DASH,
      note: [t("pedidos.tabs.solicitacoes"), t("pedidos.quantity", { count: request.quantity }), request.note].filter(Boolean).join(" · "),
    })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const statusOptions = [...new Map(rows.map(row => [row.status, row] as const)).values()].map(row => ({
    value: row.status, label: row.statusLabel, tone: row.tone, count: rows.filter(item => item.status === row.status).length,
  }))
  const query = search.trim().toLocaleLowerCase(i18n.language)
  const filtered = rows.filter(row => (!status || row.status === status) && [row.title, row.statusLabel, row.customer, row.total, row.dateLabel, row.note].filter(Boolean).join(" ").toLocaleLowerCase(i18n.language).includes(query))
  const clear = () => { setSearch(""); setStatus(null) }
  const sourceCount = data.orders.length + data.requests.length
  const failedWithoutData = !data.loading && data.errors.length > 0 && sourceCount === 0

  const columns: DataListColumn<Row>[] = [
    { id: "title", header: t("pedidos.columns.order"), cell: row => <div className="min-w-0"><Link to={row.to} className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.title}</Link>{row.note ? <p className="mt-0.5 text-xs text-muted-foreground">{row.note}</p> : null}</div> },
    { id: "customer", header: t("pedidos.columns.customer"), cell: row => row.customer },
    { id: "total", header: t("pedidos.columns.total"), cell: row => <span className="tabular-nums">{row.total}</span> },
    { id: "date", header: t("pedidos.columns.date"), cell: row => <span className="tabular-nums">{row.dateLabel}</span> },
    { id: "status", header: t("pedidos.status"), cell: row => <StatusBadge tone={row.tone}>{row.statusLabel}</StatusBadge> },
  ]

  const toolbar = <FilterBar
    label={t("pedidos.filters")}
    search={{ value: search, onChange: setSearch, placeholder: t("pedidos.search"), label: t("pedidos.search") }}
    filters={statusOptions.length > 0 ? <StatusChips label={t("pedidos.status")} allLabel={t("pedidos.allStatuses")} value={status} onChange={setStatus} options={statusOptions} allCount={rows.length} /> : undefined}
  />

  const header = { title: t("nav.pedidos"), description: t("pedidos.subtitle") }
  if (failedWithoutData) return <Page width="wide" header={header} state="error" error={data.errors.join(" ")} onRetry={data.retry}>{null}</Page>
  return <Page width="wide" header={header}>
    <div className="space-y-4">
      <FilterTabs<TabFilter>
        label={t("pedidos.type")}
        allLabel={t("pedidos.tabs.todos")}
        value={tab === "todos" ? null : tab}
        onChange={value => selectTab(value ?? "todos")}
        options={tabs.filter((value): value is TabFilter => value !== "todos").map(value => ({
          value, label: t(`pedidos.tabs.${value}`),
          ...(data.loading ? {} : { count: value === "pedidos" ? data.orders.length : data.requests.length }),
        }))}
        {...(data.loading ? {} : { allCount: sourceCount })}
        className="border-b border-border"
      />
      {data.errors.length > 0 && !failedWithoutData && !data.loading && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {data.errors.map((error, index) => <p key={index}>{error}</p>)}
        <Button variant="outline" onClick={data.retry}>{t("catalog.retry")}</Button>
      </div>}
      <DataList<Row>
        state={data.loading ? "loading" : "ready"}
        label={t("nav.pedidos")}
        loadingLabel={t("pedidos.loading")}
        toolbar={toolbar}
        columns={columns}
        rows={filtered}
        getRowId={row => row.id}
        empty={{
          title: t("pedidos.emptyTitle"),
          description: t("pedidos.emptyDescription"),
          action: search || status ? <Button variant="outline" onClick={clear}>{t("pedidos.clear")}</Button> : undefined,
        }}
        renderCard={row => <>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <Link to={row.to} className="font-medium text-foreground hover:underline [overflow-wrap:anywhere]">{row.title}</Link>
            <StatusBadge tone={row.tone}>{row.statusLabel}</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">{[row.customer !== DASH ? row.customer : null, row.total !== DASH ? row.total : null, row.dateLabel].filter(Boolean).join(" · ")}</p>
          {row.note ? <p className="text-xs text-muted-foreground">{row.note}</p> : null}
        </>}
      />
    </div>
  </Page>
}
