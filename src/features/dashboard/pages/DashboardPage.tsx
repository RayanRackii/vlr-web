import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTranslation } from "react-i18next"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { useIsPlatformAdmin } from "@/features/admin/hooks/usePlatformAdmin"
import { usePlatformTenantSession } from "@/features/admin/hooks/usePlatformTenantSession"
import { ClientDashboard } from "@/features/dashboard/components/ClientDashboard"
import { SuperAdminDashboard } from "@/features/dashboard/components/SuperAdminDashboard"
import { TechnicianDashboard } from "@/features/dashboard/components/TechnicianDashboard"
import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"
import { getDashboardMetrics } from "@/features/dashboard/services/dashboardService"
import type { CurrentUser } from "@/features/users/schemas/userSchemas"
import { getCurrentUser } from "@/features/users/services/usersService"
import { isAxiosError } from "@/lib/api"

const ASSET_PIE_COLORS = [
  "hsl(var(--chart-1, 142 76% 36%))",
  "hsl(var(--chart-2, 38 92% 50%))",
  "hsl(var(--chart-3, 215 16% 47%))",
] as const

function completionRate(total: number, completed: number): number {
  if (total === 0) {
    return 0
  }
  return Math.round((completed / total) * 100)
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "BRL",
  }).format(amount)
}

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-36" />
      </CardContent>
    </Card>
  )
}

function KpiCard({
  title,
  value,
  subtitle,
  highlight,
}: {
  title: string
  value: string | number
  subtitle: string
  highlight?: boolean
}) {
  return (
    <Card
      className={
        highlight ? "border-amber-500/40 bg-amber-500/5" : undefined
      }
    >
      <CardHeader>
        <CardTitle
          className={
            highlight ? "text-amber-800 dark:text-amber-200" : undefined
          }
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-3xl font-semibold tracking-tight ${
            highlight ? "text-amber-800 dark:text-amber-200" : ""
          }`}
        >
          {value}
        </p>
        <CardDescription className="mt-1">{subtitle}</CardDescription>
      </CardContent>
    </Card>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const isPlatformAdmin = useIsPlatformAdmin()
  const { isInTenantEnvironment } = usePlatformTenantSession()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isRoleLoading, setIsRoleLoading] = useState(true)
  const [roleError, setRoleError] = useState<string | null>(null)

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
  }, [isPlatformAdmin, isInTenantEnvironment, t])

  if (isPlatformAdmin && !isInTenantEnvironment) {
    return <SuperAdminDashboard />
  }

  if (isPlatformAdmin && isInTenantEnvironment) {
    return <TenantAdminDashboard />
  }

  if (isRoleLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (roleError || !currentUser) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
      >
        {roleError ?? t("dashboard.role.errors.loadFailed")}
      </div>
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

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadMetrics = useCallback(async () => {
    if (!session) {
      setLoadError(t("dashboard.errors.unauthorized"))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getDashboardMetrics()
      setMetrics(data)
    } catch (error: unknown) {
      console.error("DashboardPage loadMetrics failed", error)
      if (isAxiosError(error)) {
        console.error("DashboardPage loadMetrics response", error.response?.data)
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : t("dashboard.errors.loadFailed"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [session, t])

  useEffect(() => {
    void loadMetrics()
  }, [loadMetrics])

  const workOrderChartData = useMemo(() => {
    if (!metrics?.workOrders) {
      return []
    }

    return [
      {
        key: "pending",
        label: t("dashboard.charts.workOrders.pending"),
        value: metrics.workOrders.pending,
      },
      {
        key: "inProgress",
        label: t("dashboard.charts.workOrders.inProgress"),
        value: metrics.workOrders.inProgress,
      },
      {
        key: "completed",
        label: t("dashboard.charts.workOrders.completed"),
        value: metrics.workOrders.completed,
      },
    ]
  }, [metrics, t])

  const assetChartData = useMemo(() => {
    if (!metrics?.assets) {
      return []
    }

    return [
      {
        key: "active",
        name: t("dashboard.charts.assets.active"),
        value: metrics.assets.active,
      },
      {
        key: "maintenance",
        name: t("dashboard.charts.assets.maintenance"),
        value: metrics.assets.inMaintenance,
      },
      {
        key: "inactive",
        name: t("dashboard.charts.assets.inactive"),
        value: metrics.assets.inactive,
      },
    ].filter((slice) => slice.value > 0)
  }, [metrics, t])

  const hasModuleSections =
    metrics !== null &&
    (metrics.assets !== null ||
      metrics.workOrders !== null ||
      metrics.pmoc !== null ||
      metrics.maintenance !== null ||
      metrics.rentals !== null)

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.description")}
        </p>
      </div>

      {loadError !== null ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      <section className="space-y-4">
        <SectionHeading
          title={t("dashboard.sections.customers.title")}
          description={t("dashboard.sections.customers.description")}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isLoading || !metrics ? (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            <>
              <KpiCard
                title={t("dashboard.kpi.loggedInToday.title")}
                value={metrics.customerActivity.loggedInToday}
                subtitle={t("dashboard.kpi.loggedInToday.subtitle")}
              />
              <KpiCard
                title={t("dashboard.kpi.loggedInWeek.title")}
                value={metrics.customerActivity.loggedInLast7Days}
                subtitle={t("dashboard.kpi.loggedInWeek.subtitle")}
              />
              <KpiCard
                title={t("dashboard.kpi.loggedInMonth.title")}
                value={metrics.customerActivity.loggedInLast30Days}
                subtitle={t("dashboard.kpi.loggedInMonth.subtitle")}
              />
              <KpiCard
                title={t("dashboard.kpi.totalCustomers.title")}
                value={metrics.customerActivity.totalCustomers}
                subtitle={t("dashboard.kpi.totalCustomers.subtitle")}
              />
            </>
          )}
        </div>
      </section>

      {!isLoading && metrics && !hasModuleSections ? (
        <p className="text-sm text-muted-foreground">
          {t("dashboard.emptyModules")}
        </p>
      ) : null}

      {!isLoading && metrics?.assets ? (
        <section className="space-y-4">
          <SectionHeading
            title={t("dashboard.sections.assets.title")}
            description={t("dashboard.sections.assets.description")}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t("dashboard.kpi.totalAssets.title")}
              value={metrics.assets.total}
              subtitle={t("dashboard.kpi.totalAssets.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.activeAssets.title")}
              value={metrics.assets.active}
              subtitle={t("dashboard.kpi.activeAssets.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.maintenanceAssets.title")}
              value={metrics.assets.inMaintenance}
              subtitle={t("dashboard.kpi.maintenanceAssets.subtitle")}
              highlight={metrics.assets.inMaintenance > 0}
            />
            <KpiCard
              title={t("dashboard.kpi.inactiveAssets.title")}
              value={metrics.assets.inactive}
              subtitle={t("dashboard.kpi.inactiveAssets.subtitle")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-foreground">
                  {t("dashboard.charts.assets.title")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.charts.assets.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                {assetChartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {t("dashboard.charts.assets.empty")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={assetChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {assetChartData.map((entry, index) => (
                          <Cell
                            key={entry.key}
                            fill={
                              ASSET_PIE_COLORS[index % ASSET_PIE_COLORS.length]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          typeof value === "number" ? value : Number(value),
                          t("dashboard.charts.tooltip.count"),
                        ]}
                        contentStyle={{
                          borderRadius: "0.5rem",
                          borderColor: "hsl(var(--border))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-foreground">
                  {t("dashboard.charts.families.title")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.charts.families.description")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.assets.byFamily.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.charts.families.empty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {metrics.assets.byFamily.map((family) => (
                      <li
                        key={family.key}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span>{family.label}</span>
                        <span className="font-medium tabular-nums">
                          {family.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      {!isLoading && metrics?.rentals ? (
        <section className="space-y-4">
          <SectionHeading
            title={t("dashboard.sections.rentals.title")}
            description={t("dashboard.sections.rentals.description")}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t("dashboard.kpi.reservationsToday.title")}
              value={
                metrics.rentals.reservationsTodayPendingDeposit +
                metrics.rentals.reservationsTodayConfirmed +
                metrics.rentals.reservationsTodayCanceled +
                metrics.rentals.reservationsTodayCompleted
              }
              subtitle={t("dashboard.kpi.reservationsToday.subtitle", {
                pending: metrics.rentals.reservationsTodayPendingDeposit,
                confirmed: metrics.rentals.reservationsTodayConfirmed,
              })}
            />
            <KpiCard
              title={t("dashboard.kpi.confirmationRate.title")}
              value={`${metrics.rentals.confirmationRateLast7Days}%`}
              subtitle={t("dashboard.kpi.confirmationRate.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.slotsToday.title")}
              value={`${metrics.rentals.slotsBookedToday}/${metrics.rentals.slotsAvailableToday + metrics.rentals.slotsBookedToday}`}
              subtitle={t("dashboard.kpi.slotsToday.subtitle", {
                available: metrics.rentals.slotsAvailableToday,
                booked: metrics.rentals.slotsBookedToday,
              })}
            />
            <KpiCard
              title={t("dashboard.kpi.reservedRevenue.title")}
              value={formatMoney(metrics.rentals.reservedRevenueThisMonth)}
              subtitle={t("dashboard.kpi.reservedRevenue.subtitle")}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              title={t("dashboard.kpi.rentableSpaces.title")}
              value={metrics.rentals.rentableSpaces}
              subtitle={t("dashboard.kpi.rentableSpaces.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.rentableGoods.title")}
              value={metrics.rentals.rentableGoods}
              subtitle={t("dashboard.kpi.rentableGoods.subtitle")}
            />
          </div>
        </section>
      ) : null}

      {!isLoading && metrics?.workOrders ? (
        <section className="space-y-4">
          <SectionHeading
            title={t("dashboard.sections.workOrders.title")}
            description={t("dashboard.sections.workOrders.description")}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title={t("dashboard.kpi.workOrdersMonth.title")}
              value={metrics.workOrders.totalThisMonth}
              subtitle={t("dashboard.kpi.workOrdersMonth.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.completionRate.title")}
              value={`${completionRate(
                metrics.workOrders.totalThisMonth,
                metrics.workOrders.completed,
              )}%`}
              subtitle={t("dashboard.kpi.completionRate.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.pendingWorkOrders.title")}
              value={metrics.workOrders.pending}
              subtitle={t("dashboard.kpi.pendingWorkOrders.subtitle")}
              highlight={metrics.workOrders.pending > 0}
            />
            <KpiCard
              title={t("dashboard.kpi.inProgressWorkOrders.title")}
              value={metrics.workOrders.inProgress}
              subtitle={t("dashboard.kpi.inProgressWorkOrders.subtitle")}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base text-foreground">
                {t("dashboard.charts.workOrders.title")}
              </CardTitle>
              <CardDescription>
                {t("dashboard.charts.workOrders.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workOrderChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === "number" ? value : Number(value),
                      t("dashboard.charts.tooltip.count"),
                    ]}
                    labelFormatter={(label) => String(label)}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      borderColor: "hsl(var(--border))",
                    }}
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    name={t("dashboard.charts.tooltip.count")}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {!isLoading && metrics?.pmoc ? (
        <section className="space-y-4">
          <SectionHeading
            title={t("dashboard.sections.pmoc.title")}
            description={t("dashboard.sections.pmoc.description")}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title={t("dashboard.kpi.activePlans.title")}
              value={metrics.pmoc.activePlans}
              subtitle={t("dashboard.kpi.activePlans.subtitle")}
            />
            <KpiCard
              title={t("dashboard.kpi.pmocWorkOrders.title")}
              value={metrics.pmoc.workOrdersFromPlansThisMonth}
              subtitle={t("dashboard.kpi.pmocWorkOrders.subtitle")}
            />
            {metrics.pmoc.electricalTotal !== null ? (
              <KpiCard
                title={t("dashboard.kpi.electricalAssets.title")}
                value={metrics.pmoc.electricalTotal}
                subtitle={t("dashboard.kpi.electricalAssets.subtitle")}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {!isLoading && metrics?.maintenance ? (
        <section className="space-y-4">
          <SectionHeading
            title={t("dashboard.sections.maintenance.title")}
            description={t("dashboard.sections.maintenance.description")}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              title={t("dashboard.kpi.assetsInMaintenance.title")}
              value={metrics.maintenance.assetsInMaintenance}
              subtitle={t("dashboard.kpi.assetsInMaintenance.subtitle")}
              highlight={metrics.maintenance.assetsInMaintenance > 0}
            />
            <KpiCard
              title={t("dashboard.kpi.openMaintenanceOrders.title")}
              value={metrics.maintenance.openWorkOrders}
              subtitle={t("dashboard.kpi.openMaintenanceOrders.subtitle")}
              highlight={metrics.maintenance.openWorkOrders > 0}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
