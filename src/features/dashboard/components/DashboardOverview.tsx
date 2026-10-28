import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { buildProductSections } from "@/components/layout/navigation"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"
import { hasSlotsToday, reservationsTodayTotal } from "@/features/dashboard/pages/dashboardMetrics"
import { usePermissions } from "@/features/users/permissions/PermissionContext"

// Destinations and access come from the same catalog as the staff sidebar.
const SHORTCUTS = ["nav.reservations", "nav.workOrders", "nav.assets", "nav.pmoc"] as const

function useDashboardShortcuts() {
  const { activeModules, permissions } = usePermissions()
  const items = buildProductSections(activeModules, permissions).flatMap((section) => section.items)
  return SHORTCUTS.flatMap((key) => {
    const item = items.find((entry) => entry.labelKey === key)
    return item ? [item] : []
  })
}

export function DashboardHero({ metrics }: { metrics: DashboardMetrics | null }) {
  const { t, i18n } = useTranslation()
  const shortcuts = useDashboardShortcuts().filter((item) => item.labelKey === "nav.reservations" || item.labelKey === "nav.workOrders")
  const rentals = metrics?.rentals
  const pulses: { title: string; value: number | string; description: string }[] = []
  if (rentals) pulses.push({
    title: t("dashboard.kpi.reservationsToday.title"), value: reservationsTodayTotal(rentals),
    description: t("dashboard.kpi.reservationsToday.subtitle", { pending: rentals.reservationsTodayPendingDeposit, confirmed: rentals.reservationsTodayConfirmed }),
  })
  if (metrics?.workOrders) pulses.push({ title: t("dashboard.kpi.pendingWorkOrders.title"), value: metrics.workOrders.pending, description: t("dashboard.kpi.pendingWorkOrders.subtitle") })
  if (metrics?.maintenance) pulses.push({ title: t("dashboard.kpi.assetsInMaintenance.title"), value: metrics.maintenance.assetsInMaintenance, description: t("dashboard.kpi.maintenanceAssets.subtitle") })
  if (rentals && hasSlotsToday(rentals)) pulses.push({ title: t("dashboard.kpi.slotsToday.title"), value: `${rentals.slotsBookedToday}/${rentals.slotsBookedToday + rentals.slotsAvailableToday}`, description: t("dashboard.home.freeSlots", { count: rentals.slotsAvailableToday }) })

  const today = new Date()
  return (
    <header className="staff-dashboard-hero">
      <div className="staff-dashboard-hero-top">
        <div className="staff-dashboard-hero-copy">
          <time dateTime={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`}>
            {today.toLocaleDateString(i18n.language, { weekday: "long", day: "numeric", month: "long" })}
          </time>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.description")}</p>
        </div>
        {shortcuts.length ? <div className="staff-dashboard-cta">
          {shortcuts.map(({ to, labelKey, icon: Icon }, index) => (
            <Link key={labelKey} to={to} className={`staff-dashboard-button ${index === 0 ? "staff-dashboard-button-primary" : "staff-dashboard-button-ghost"}`}>
              <Icon aria-hidden="true" />{t(labelKey)}
            </Link>
          ))}
        </div> : null}
      </div>
      {pulses.length ? <dl className="staff-dashboard-pulse">
        {pulses.map((pulse) => <div key={pulse.title}>
          <dt>{pulse.title}</dt><dd><strong>{pulse.value}</strong><span>{pulse.description}</span></dd>
        </div>)}
      </dl> : null}
    </header>
  )
}

export function DashboardQuickAccess() {
  const { t } = useTranslation()
  const shortcuts = useDashboardShortcuts()
  if (!shortcuts.length) return null
  return (
    <nav className="staff-dashboard-section" aria-labelledby="dashboard-quick-access">
      <SectionHeading id="dashboard-quick-access" title={t("dashboard.home.quickAccess")} />
      <div className="staff-dashboard-shortcuts">
        {shortcuts.map(({ to, labelKey, icon: Icon }, index) => (
          <Link key={labelKey} to={to} className="staff-dashboard-tile" style={{ animationDelay: `${index * 55}ms` }}>
            <span className="staff-dashboard-tile-icon"><Icon aria-hidden="true" /></span>
            <strong>{labelKey === "nav.pmoc" ? t("dashboard.sections.maintenance.title") : t(labelKey)}</strong>
            <p>{t(`dashboard.home.shortcuts.${labelKey.slice(4)}`)}</p>
            <span className="staff-dashboard-go">{t("dashboard.home.open")}<ArrowRight aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function SectionHeading({ id, title, description }: { id: string; title: string; description?: string }) {
  return <div className="staff-dashboard-section-heading"><h2 id={id}>{title}</h2>{description ? <p>{description}</p> : null}</div>
}

export function DashboardPanel({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return <Card role="region" aria-labelledby={id} className="staff-dashboard-panel">
    <div><h2 id={id}>{title}</h2><p className="staff-dashboard-panel-description">{description}</p></div>
    {children}
  </Card>
}

export function KpiSkeleton() {
  return <Card className="staff-dashboard-kpi"><Skeleton className="h-4 w-28 max-w-full" /><Skeleton className="h-8 w-20 max-w-full" /><Skeleton className="h-3 w-40 max-w-full" /></Card>
}

export function KpiCard({ title, value, subtitle, highlight = false }: { title: string; value: string | number; subtitle: string; highlight?: boolean }) {
  return <Card className="staff-dashboard-kpi" data-highlight={highlight || undefined}>
    <dl><dt>{title}</dt><dd><strong>{value}</strong><span>{subtitle}</span></dd></dl>
  </Card>
}
