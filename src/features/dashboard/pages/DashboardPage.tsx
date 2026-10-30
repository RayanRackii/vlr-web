import { useEffect, useState } from "react"
import { BarChart3, Layers } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { ClientDashboard } from "@/features/dashboard/components/ClientDashboard"
import { SuperAdminDashboard } from "@/features/dashboard/components/SuperAdminDashboard"
import { TechnicianDashboard } from "@/features/dashboard/components/TechnicianDashboard"
import { DashboardHero, DashboardQuickAccess, KpiCard, KpiSkeleton, SectionHeading } from "@/features/dashboard/components/DashboardOverview"
import { DashboardCharts } from "@/features/dashboard/components/DashboardCharts"
import { RentalsReadinessCard } from "@/features/rentals/components/RentalsReadinessCard"
import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"
import { getDashboardMetrics } from "@/features/dashboard/services/dashboardService"
import { hasSlotsToday, reservationsTodayTotal } from "@/features/dashboard/pages/dashboardMetrics"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import { getCurrentUser } from "@/features/users/services/usersService"
import { isAxiosError } from "@/lib/api"
import i18n from "@/lib/i18n"
import { formatLocaleCurrency } from "@/lib/localeFormat"
import "./staffDashboard.css"

function completionRate(total: number, completed: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100)
}

export function DashboardPage() {
  const { t } = useTranslation()
  const isPlatformAdmin = useIsPlatformAdmin()
  const { isInTenantEnvironment } = usePlatformTenantSession()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isRoleLoading, setIsRoleLoading] = useState(true)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleAttempt, setRoleAttempt] = useState(0)

  useEffect(() => {
    if (isPlatformAdmin && !isInTenantEnvironment) {
      setIsRoleLoading(false)
      setRoleError(null)
      return
    }

    let isActive = true

    async function loadCurrentUser() {
      setIsRoleLoading(true)
      setRoleError(null)

      try {
        const profile = await getCurrentUser()
        if (isActive) {
          setCurrentUser(profile)
        }
      } catch (error: unknown) {
        if (isActive) {
          setRoleError(
            error instanceof Error
              ? error.message
              : t("dashboard.role.errors.loadFailed"),
          )
        }
      } finally {
        if (isActive) {
          setIsRoleLoading(false)
        }
      }
    }

    void loadCurrentUser()

    return () => {
      isActive = false
    }
  }, [isPlatformAdmin, isInTenantEnvironment, t, roleAttempt])

  if (isPlatformAdmin && !isInTenantEnvironment) {
    return <SuperAdminDashboard />
  }

  if (isPlatformAdmin && isInTenantEnvironment) {
    return <TenantAdminDashboard />
  }

  if (isRoleLoading) {
    return (
      <div aria-busy="true" className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      </div>
    )
  }

  if (roleError || !currentUser) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {roleError ?? t("dashboard.role.errors.loadFailed")}
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => setRoleAttempt((attempt) => attempt + 1)}>
            {t("common.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (
    currentUser.role === "TECHNICIAN" ||
    currentUser.role === "USER"
  ) {
    return <TechnicianDashboard />
  }

  if (currentUser.role === "CLIENT") {
    return <ClientDashboard />
  }

  return <TenantAdminDashboard />
}

export function TenantAdminDashboard() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadMetrics() {
      if (!userId) {
        if (!cancelled) {
          setLoadError(t("dashboard.errors.unauthorized"))
          setIsLoading(false)
        }
        return
      }

      if (!cancelled) {
        setLoadError(null)
        setIsLoading(true)
      }

      try {
        const data = await getDashboardMetrics()
        if (!cancelled) {
          setMetrics(data)
        }
      } catch (error: unknown) {
        console.error("DashboardPage loadMetrics failed", error)
        if (isAxiosError(error)) {
          console.error(
            "DashboardPage loadMetrics response",
            error.response?.data,
          )
        }

        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : t("dashboard.errors.loadFailed"),
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadMetrics()

    return () => {
      cancelled = true
    }
  }, [userId, t, loadAttempt])

  const hasModuleSections = metrics !== null &&
    [metrics.assets, metrics.workOrders, metrics.pmoc, metrics.maintenance, metrics.rentals].some((section) => section !== null)
  // Do not present retained values as current after a failed refresh.
  const visibleMetrics = !isLoading && !loadError ? metrics : null

  return (
    <div aria-busy={isLoading} className="staff-dashboard">
      <DashboardHero metrics={visibleMetrics} />
      <div className="staff-dashboard-readiness"><RentalsReadinessCard /></div>

      {loadError !== null ? (
        <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
      ) : null}

      {visibleMetrics && hasModuleSections ? <DashboardQuickAccess /> : null}

      {!visibleMetrics || hasModuleSections ? <section className="staff-dashboard-section" aria-labelledby="dashboard-customers">
        <SectionHeading id="dashboard-customers" title={t("dashboard.sections.customers.title")} description={t("dashboard.sections.customers.description")} />
        <div className="staff-dashboard-kpis">
          {isLoading ? <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></> : visibleMetrics ? <>
            <KpiCard title={t("dashboard.kpi.loggedInToday.title")} value={visibleMetrics.customerActivity.loggedInToday} subtitle={t("dashboard.kpi.loggedInToday.subtitle")} />
            <KpiCard title={t("dashboard.kpi.loggedInWeek.title")} value={visibleMetrics.customerActivity.loggedInLast7Days} subtitle={t("dashboard.kpi.loggedInWeek.subtitle")} />
            <KpiCard title={t("dashboard.kpi.loggedInMonth.title")} value={visibleMetrics.customerActivity.loggedInLast30Days} subtitle={t("dashboard.kpi.loggedInMonth.subtitle")} />
            <KpiCard title={t("dashboard.kpi.totalCustomers.title")} value={visibleMetrics.customerActivity.totalCustomers} subtitle={t("dashboard.kpi.totalCustomers.subtitle")} />
          </> : (
            <Card className="staff-dashboard-unavailable"><CardContent>
              <EmptyState size="sm" icon={BarChart3} title={t("dashboard.unavailable")} action={<Button variant="outline" className="min-h-11" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>{t("common.retry")}</Button>} />
            </CardContent></Card>
          )}
        </div>
      </section> : null}

      {visibleMetrics && !hasModuleSections ? (
        <Card className="staff-dashboard-empty"><EmptyState icon={Layers} title={t("dashboard.emptyModules")} description={t("dashboard.emptyDescription")} /></Card>
      ) : null}

      {visibleMetrics?.rentals ? (
        <section className="staff-dashboard-section" aria-labelledby="dashboard-rentals">
          <SectionHeading id="dashboard-rentals" title={t("dashboard.sections.rentals.title")} description={t("dashboard.sections.rentals.description")} />
          <div className="staff-dashboard-kpis">
            <KpiCard title={t("dashboard.kpi.reservationsToday.title")} value={reservationsTodayTotal(visibleMetrics.rentals)} subtitle={t("dashboard.kpi.reservationsToday.subtitle", { pending: visibleMetrics.rentals.reservationsTodayPendingDeposit, confirmed: visibleMetrics.rentals.reservationsTodayConfirmed })} />
            <KpiCard title={t("dashboard.kpi.confirmationRate.title")} value={`${visibleMetrics.rentals.confirmationRateLast7Days}%`} subtitle={t("dashboard.kpi.confirmationRate.subtitle")} />
            {hasSlotsToday(visibleMetrics.rentals) ? <KpiCard title={t("dashboard.kpi.slotsToday.title")} value={`${visibleMetrics.rentals.slotsBookedToday}/${visibleMetrics.rentals.slotsAvailableToday + visibleMetrics.rentals.slotsBookedToday}`} subtitle={t("dashboard.kpi.slotsToday.subtitle", { available: visibleMetrics.rentals.slotsAvailableToday, booked: visibleMetrics.rentals.slotsBookedToday })} /> : null}
            <KpiCard title={t("dashboard.kpi.reservedRevenue.title")} value={formatLocaleCurrency(visibleMetrics.rentals.reservedRevenueThisMonth, "BRL", i18n.language)} subtitle={t("dashboard.kpi.reservedRevenue.subtitle")} />
          </div>
        </section>
      ) : null}

      {visibleMetrics?.workOrders ? (
        <section className="staff-dashboard-section" aria-labelledby="dashboard-work-orders">
          <SectionHeading id="dashboard-work-orders" title={t("dashboard.sections.workOrders.title")} description={t("dashboard.sections.workOrders.description")} />
          <div className="staff-dashboard-kpis">
            <KpiCard title={t("dashboard.kpi.workOrdersMonth.title")} value={visibleMetrics.workOrders.totalThisMonth} subtitle={t("dashboard.kpi.workOrdersMonth.subtitle")} />
            <KpiCard title={t("dashboard.kpi.completionRate.title")} value={`${completionRate(visibleMetrics.workOrders.totalThisMonth, visibleMetrics.workOrders.completed)}%`} subtitle={t("dashboard.kpi.completionRate.subtitle")} />
            <KpiCard title={t("dashboard.kpi.pendingWorkOrders.title")} value={visibleMetrics.workOrders.pending} subtitle={t("dashboard.kpi.pendingWorkOrders.subtitle")} highlight={visibleMetrics.workOrders.pending > 0} />
            <KpiCard title={t("dashboard.kpi.inProgressWorkOrders.title")} value={visibleMetrics.workOrders.inProgress} subtitle={t("dashboard.kpi.inProgressWorkOrders.subtitle")} />
          </div>
        </section>
      ) : null}

      {visibleMetrics ? <DashboardCharts metrics={visibleMetrics} /> : null}

      {visibleMetrics?.pmoc ? (
        <section className="staff-dashboard-section" aria-labelledby="dashboard-pmoc">
          <SectionHeading id="dashboard-pmoc" title={t("dashboard.sections.pmoc.title")} description={t("dashboard.sections.pmoc.description")} />
          <div className="staff-dashboard-kpis">
            <KpiCard title={t("dashboard.kpi.activePlans.title")} value={visibleMetrics.pmoc.activePlans} subtitle={t("dashboard.kpi.activePlans.subtitle")} />
            <KpiCard title={t("dashboard.kpi.pmocWorkOrders.title")} value={visibleMetrics.pmoc.workOrdersFromPlansThisMonth} subtitle={t("dashboard.kpi.pmocWorkOrders.subtitle")} />
            {visibleMetrics.pmoc.electricalTotal !== null ? <KpiCard title={t("dashboard.kpi.electricalAssets.title")} value={visibleMetrics.pmoc.electricalTotal} subtitle={t("dashboard.kpi.electricalAssets.subtitle")} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
