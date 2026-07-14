import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  createMaintenancePlanRequestSchema,
  maintenancePlanListSchema,
  maintenancePlanSchema,
  type CreateMaintenancePlanRequest,
  type MaintenancePlan,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import {
  globalMaintenanceTemplateListSchema,
  type GlobalMaintenanceTemplate,
} from "@/features/pmoc/schemas/globalTemplateSchemas"

const MAINTENANCE_PLANS_PATH = "/api/maintenance-plans"
const GLOBAL_TEMPLATES_PATH = "/api/global-templates"

export async function getGlobalTemplates(
  jurisdiction?: string,
): Promise<GlobalMaintenanceTemplate[]> {
  try {
    const response = await api.get<unknown>(GLOBAL_TEMPLATES_PATH, {
      params:
        jurisdiction && jurisdiction.trim().length > 0
          ? { jurisdiction: jurisdiction.trim() }
          : undefined,
    })
    const parsed = globalMaintenanceTemplateListSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getGlobalTemplates Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.templates.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getGlobalTemplates failed", error)
    if (isAxiosError(error)) {
      console.error("getGlobalTemplates response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("pmoc.templates.errors.loadFailed"),
      ),
    )
  }
}

export async function getPlans(): Promise<MaintenancePlan[]> {
  try {
    const response = await api.get<unknown>(MAINTENANCE_PLANS_PATH)
    const data = response.data
    const parsed = maintenancePlanListSchema.safeParse(data)

    if (!parsed.success) {
      console.error("getPlans Zod validation failed", {
        data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getPlans failed", error)
    if (isAxiosError(error)) {
      console.error("getPlans response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("pmoc.plans.errors.loadFailed"),
      ),
    )
  }
}

export async function createPlan(
  payload: CreateMaintenancePlanRequest,
): Promise<MaintenancePlan> {
  const validatedPayload = createMaintenancePlanRequestSchema.parse(payload)

  try {
    const response = await api.post<unknown>(
      MAINTENANCE_PLANS_PATH,
      validatedPayload,
    )
    const data = response.data
    const parsed = maintenancePlanSchema.safeParse(data)

    if (!parsed.success) {
      console.error("createPlan Zod validation failed", {
        data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("createPlan failed", error)
    if (isAxiosError(error)) {
      console.error("createPlan response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("pmoc.plans.errors.createFailed"),
      ),
    )
  }
}
