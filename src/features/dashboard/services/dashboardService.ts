import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  dashboardMetricsSchema,
  type DashboardMetrics,
} from "@/features/dashboard/schemas/dashboardSchemas"

const DASHBOARD_METRICS_PATH = "/api/dashboard/metrics"

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const response = await api.get<unknown>(DASHBOARD_METRICS_PATH)
    const parsed = dashboardMetricsSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getDashboardMetrics Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("dashboard.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getDashboardMetrics failed", error)
    if (isAxiosError(error)) {
      console.error("getDashboardMetrics response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("dashboard.errors.loadFailed"),
      ),
    )
  }
}
