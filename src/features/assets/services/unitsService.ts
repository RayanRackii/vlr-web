import i18n from "@/lib/i18n"
import { api, isAxiosError } from "@/lib/api"
import { describeApiError } from "@/features/users/permissions/rbacErrors"
import {
  createUnitRequestSchema,
  unitSchema,
  unitListSchema,
  type CreateUnitRequest,
  type Unit,
} from "@/features/assets/schemas/unitSchemas"

const UNITS_PATH = "/api/units"

export async function getUnits(): Promise<Unit[]> {
  try {
    const response = await api.get<unknown>(UNITS_PATH)
    const data = response.data
    const parsed = unitListSchema.safeParse(data)

    if (!parsed.success) {
      console.error("getUnits Zod validation failed", {
        data,
        error: parsed.error.flatten(),
        issues: parsed.error.issues,
      })
      throw new Error(i18n.t("assets.inventory.errors.invalidUnitsResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    console.error("getUnits failed", error)
    if (isAxiosError(error)) {
      console.error("getUnits response data", error.response?.data)
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      describeApiError(error, i18n.t("assets.inventory.errors.loadUnitsFailed")),
      { cause: error },
    )
  }
}

export async function createUnit(body: CreateUnitRequest): Promise<Unit> {
  const payload = createUnitRequestSchema.parse(body)

  try {
    const response = await api.post<unknown>(UNITS_PATH, payload)
    const parsed = unitSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error(i18n.t("apiErrors.invalidPayload"))
    }
    return parsed.data
  } catch (error: unknown) {
    if (isAxiosError(error) && error.response?.status === 409) {
      throw new Error(i18n.t("rentals.resources.inlineCreate.unitDuplicate"), {
        cause: error,
      })
    }

    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      describeApiError(error, i18n.t("rentals.resources.inlineCreate.unitCreateError")),
      { cause: error },
    )
  }
}
