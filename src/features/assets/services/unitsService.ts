import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  unitListSchema,
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
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("assets.inventory.errors.loadUnitsFailed"),
      ),
    )
  }
}
