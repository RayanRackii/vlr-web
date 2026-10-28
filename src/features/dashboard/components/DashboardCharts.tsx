import { BarChart3, Boxes, Layers } from "lucide-react"
import { useTranslation } from "react-i18next"

import { EmptyState } from "@/components/ui/empty-state"
import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"
import { DashboardPanel, KpiCard } from "./DashboardOverview"

export function DashboardCharts({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useTranslation()
  const workOrders = metrics.workOrders
  const assets = metrics.assets
  const statuses = assets ? [
    { key: "active", value: assets.active, color: "var(--success)" },
    { key: "maintenance", value: assets.inMaintenance, color: "var(--warning)" },
    { key: "inactive", value: assets.inactive, color: "var(--muted-foreground)" },
  ] : []
  const assetTotal = statuses.reduce((total, status) => total + status.value, 0)
  const activePercent = assetTotal ? (statuses[0].value / assetTotal) * 100 : 0
  const maintenanceEnd = assetTotal ? activePercent + (statuses[1].value / assetTotal) * 100 : 0
  const bars = workOrders ? [
    { key: "pending", value: workOrders.pending, color: "var(--warning)" },
    { key: "inProgress", value: workOrders.inProgress, color: "var(--info)" },
    { key: "completed", value: workOrders.completed, color: "var(--success)" },
  ] : []
  const maxBar = Math.max(1, ...bars.map((bar) => bar.value))

  return <>
    {workOrders || assets ? <div className="staff-dashboard-two">
      {workOrders ? <DashboardPanel id="dashboard-order-status" title={t("dashboard.charts.workOrders.title")} description={t("dashboard.charts.workOrders.description")}>
        {bars.every((bar) => bar.value === 0) ? <EmptyState size="sm" icon={BarChart3} title={t("dashboard.workOrdersEmpty")} description={t("dashboard.emptyDescription")} /> : (
          <dl className="staff-dashboard-bars">
            {bars.map((bar) => <div key={bar.key}>
              <dt>{t(`dashboard.charts.workOrders.${bar.key}`)}</dt>
              <dd><strong>{bar.value}</strong><span aria-hidden="true" style={{ height: `${bar.value / maxBar * 100}%`, background: bar.color }} /></dd>
            </div>)}
          </dl>
        )}
      </DashboardPanel> : null}
      {assets ? <DashboardPanel id="dashboard-resource-status" title={t("dashboard.charts.assets.title")} description={t("dashboard.charts.assets.description")}>
        {assetTotal === 0 ? <EmptyState size="sm" icon={Boxes} title={t("dashboard.charts.assets.empty")} description={t("dashboard.emptyDescription")} /> : (
          <div className="staff-dashboard-donut">
            <div className="staff-dashboard-ring" aria-hidden="true" style={{ background: `conic-gradient(var(--success) 0 ${activePercent}%, var(--warning) ${activePercent}% ${maintenanceEnd}%, var(--muted-foreground) ${maintenanceEnd}% 100%)` }} />
            <dl className="staff-dashboard-legend">{statuses.map((status) => <div key={status.key}>
              <dt><span aria-hidden="true" style={{ background: status.color }} />{t(`dashboard.charts.assets.${status.key}`)}</dt><dd>{status.value}</dd>
            </div>)}</dl>
          </div>
        )}
      </DashboardPanel> : null}
    </div> : null}
    {assets || metrics.maintenance ? <div className="staff-dashboard-two">
      {assets ? <DashboardPanel id="dashboard-families" title={t("dashboard.charts.families.title")} description={t("dashboard.charts.families.description")}>
        {assets.byFamily.length === 0 ? <EmptyState size="sm" icon={Layers} title={t("dashboard.charts.families.empty")} description={t("dashboard.emptyDescription")} /> : (
          <ul className="staff-dashboard-families">{assets.byFamily.map((family) => <li key={family.key}><span>{family.label}</span><strong>{family.count}</strong></li>)}</ul>
        )}
      </DashboardPanel> : null}
      {metrics.maintenance ? <DashboardPanel id="dashboard-maintenance" title={t("dashboard.sections.maintenance.title")} description={t("dashboard.sections.maintenance.description")}>
        <div className="staff-dashboard-kpis staff-dashboard-maintenance-kpis">
          <KpiCard title={t("dashboard.kpi.assetsInMaintenance.title")} value={metrics.maintenance.assetsInMaintenance} subtitle={t("dashboard.kpi.assetsInMaintenance.subtitle")} highlight={metrics.maintenance.assetsInMaintenance > 0} />
          <KpiCard title={t("dashboard.kpi.openMaintenanceOrders.title")} value={metrics.maintenance.openWorkOrders} subtitle={t("dashboard.kpi.openMaintenanceOrders.subtitle")} highlight={metrics.maintenance.openWorkOrders > 0} />
        </div>
      </DashboardPanel> : null}
    </div> : null}
  </>
}
