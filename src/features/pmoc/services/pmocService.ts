import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  createFromTemplateRequestSchema,
  createMaintenancePlanRequestSchema,
  maintenancePlanListSchema,
  maintenancePlanSchema,
  replacePlanTasksRequestSchema,
  updateMaintenancePlanRequestSchema,
  type CreateFromTemplateRequest,
  type CreateMaintenancePlanRequest,
  type MaintenancePlan,
  type ReplacePlanTasksRequest,
  type UpdateMaintenancePlanRequest,
} from "@/features/pmoc/schemas/maintenancePlanSchemas"
import {
  globalMaintenanceTemplateListSchema,
  globalMaintenanceTemplateSchema,
  type GlobalMaintenanceTemplate,
} from "@/features/pmoc/schemas/globalTemplateSchemas"

const MAINTENANCE_PLANS_PATH = "/api/maintenance-plans"
const GLOBAL_TEMPLATES_PATH = "/api/global-templates"

export const PLAN_IN_USE_CODE = "PLAN_IN_USE"

export class PlanInUseError extends Error {
  readonly code = PLAN_IN_USE_CODE

  constructor(message: string) {
    super(message)
    this.name = "PlanInUseError"
  }
}

export function isPlanInUseError(error: unknown): error is PlanInUseError {
  return error instanceof PlanInUseError
}

function throwPmocServiceError(error: unknown, fallbackKey: string): never {
  if (error instanceof Error && !isAxiosError(error)) {
    throw error
  }

  throw new Error(
    parseApiError(getAxiosErrorPayload(error), i18n.t(fallbackKey)),
  )
}

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

    throwPmocServiceError(error, "pmoc.templates.errors.loadFailed")
  }
}

export async function getTemplateById(
  id: string,
): Promise<GlobalMaintenanceTemplate> {
  try {
    const response = await api.get<unknown>(`${GLOBAL_TEMPLATES_PATH}/${id}`)
    const parsed = globalMaintenanceTemplateSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getTemplateById Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.templates.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getTemplateById failed", error)
    if (isAxiosError(error)) {
      console.error("getTemplateById response data", error.response?.data)
    }

    throwPmocServiceError(error, "pmoc.templates.errors.loadFailed")
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

    throwPmocServiceError(error, "pmoc.plans.errors.loadFailed")
  }
}

export async function getPlan(id: string): Promise<MaintenancePlan> {
  try {
    const response = await api.get<unknown>(`${MAINTENANCE_PLANS_PATH}/${id}`)
    const parsed = maintenancePlanSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("getPlan Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getPlan failed", error)
    if (isAxiosError(error)) {
      console.error("getPlan response data", error.response?.data)
    }

    throwPmocServiceError(error, "pmoc.plans.errors.loadFailed")
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

    throwPmocServiceError(error, "pmoc.plans.errors.createFailed")
  }
}

export async function createFromTemplate(
  payload: CreateFromTemplateRequest,
): Promise<MaintenancePlan> {
  const validatedPayload = createFromTemplateRequestSchema.parse(payload)

  try {
    const response = await api.post<unknown>(
      `${MAINTENANCE_PLANS_PATH}/from-template`,
      validatedPayload,
    )
    const parsed = maintenancePlanSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("createFromTemplate Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("createFromTemplate failed", error)
    if (isAxiosError(error)) {
      console.error("createFromTemplate response data", error.response?.data)
    }

    throwPmocServiceError(error, "pmoc.preview.errors.cloneFailed")
  }
}

export async function updatePlan(
  id: string,
  payload: UpdateMaintenancePlanRequest,
): Promise<MaintenancePlan> {
  const validatedPayload = updateMaintenancePlanRequestSchema.parse(payload)

  try {
    const response = await api.put<unknown>(
      `${MAINTENANCE_PLANS_PATH}/${id}`,
      validatedPayload,
    )
    const parsed = maintenancePlanSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("updatePlan Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("updatePlan failed", error)
    if (isAxiosError(error)) {
      console.error("updatePlan response data", error.response?.data)
    }

    throwPmocServiceError(error, "pmoc.plans.errors.updateFailed")
  }
}

export async function replaceTasks(
  id: string,
  payload: ReplacePlanTasksRequest,
): Promise<MaintenancePlan> {
  const validatedPayload = replacePlanTasksRequestSchema.parse(payload)

  try {
    const response = await api.put<unknown>(
      `${MAINTENANCE_PLANS_PATH}/${id}/tasks`,
      validatedPayload,
    )
    const parsed = maintenancePlanSchema.safeParse(response.data)

    if (!parsed.success) {
      console.error("replaceTasks Zod validation failed", {
        data: response.data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("replaceTasks failed", error)
    if (isAxiosError(error)) {
      console.error("replaceTasks response data", error.response?.data)
    }

    throwPmocServiceError(error, "pmoc.plans.errors.replaceTasksFailed")
  }
}

export async function deletePlan(id: string): Promise<void> {
  try {
    await api.delete(`${MAINTENANCE_PLANS_PATH}/${id}`)
  } catch (error: unknown) {
    console.error("deletePlan failed", error)
    if (isAxiosError(error)) {
      console.error("deletePlan response data", error.response?.data)
    }

    if (isAxiosError(error) && error.response?.status === 409) {
      const payload = getAxiosErrorPayload(error)
      if (
        typeof payload === "object" &&
        payload !== null &&
        "code" in payload &&
        payload.code === PLAN_IN_USE_CODE
      ) {
        throw new PlanInUseError(i18n.t("pmoc.plans.errors.planInUse"))
      }
    }

    throwPmocServiceError(error, "pmoc.plans.errors.deleteFailed")
  }
}
