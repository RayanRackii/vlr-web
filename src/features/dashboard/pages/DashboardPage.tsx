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
import type { DashboardMetrics } from "@/features/dashboard/schemas/dashboardSchemas"
import { getDashboardMetrics } from "@/features/dashboard/services/dashboardService"
import { isAxiosError } from "@/lib/api"

const ASSET_PIE_COLORS = [
  "hsl(var(--chart-1, 142 76% 36%))",
  "hsl(var(--chart-2, 38 92% 50%))",
  "hsl(var(--chart-3, 215 16% 47%))",
] as const

function completionRate(metrics: DashboardMetrics): number {
  const total = metrics.workOrders.totalThisMonth
  if (total === 0) {
    return 0
  }

  return Math.round((metrics.workOrders.completed / total) * 100)
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

export function DashboardPage() {
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
    if (!metrics) {
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
    if (!metrics) {
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

  const pendingHighlight =
    metrics !== null && metrics.workOrders.pending > 0

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : metrics ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.kpi.totalAssets.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">
                  {metrics.assets.total}
                </p>
                <CardDescription className="mt-1">
                  {t("dashboard.kpi.totalAssets.subtitle")}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.kpi.workOrdersMonth.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">
                  {metrics.workOrders.totalThisMonth}
                </p>
                <CardDescription className="mt-1">
                  {t("dashboard.kpi.workOrdersMonth.subtitle")}
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.kpi.completionRate.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight">
                  {completionRate(metrics)}%
                </p>
                <CardDescription className="mt-1">
                  {t("dashboard.kpi.completionRate.subtitle")}
                </CardDescription>
              </CardContent>
            </Card>

            <Card
              className={
                pendingHighlight
                  ? "border-amber-500/40 bg-amber-500/5"
                  : undefined
              }
            >
              <CardHeader>
                <CardTitle
                  className={
                    pendingHighlight ? "text-amber-800 dark:text-amber-200" : undefined
                  }
                >
                  {t("dashboard.kpi.pendingWorkOrders.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-3xl font-semibold tracking-tight ${
                    pendingHighlight
                      ? "text-amber-800 dark:text-amber-200"
                      : ""
                  }`}
                >
                  {metrics.workOrders.pending}
                </p>
                <CardDescription className="mt-1">
                  {t("dashboard.kpi.pendingWorkOrders.subtitle")}
                </CardDescription>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workOrderChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
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
            )}
          </CardContent>
        </Card>

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
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : assetChartData.length === 0 ? (
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
                        fill={ASSET_PIE_COLORS[index % ASSET_PIE_COLORS.length]}
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
      </div>
    </div>
  )
}
