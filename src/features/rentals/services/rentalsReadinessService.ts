import type { RentalsReadiness } from "@/features/rentals/schemas/rentalsReadinessSchemas"
import { rentalsReadinessSchema } from "@/features/rentals/schemas/rentalsReadinessSchemas"
import i18n from "@/lib/i18n"
import { api } from "@/lib/api"

const RENTALS_READINESS_PATH = "/api/rentals/readiness"

export async function getRentalsReadiness(): Promise<RentalsReadiness> {
  const response = await api.get<unknown>(RENTALS_READINESS_PATH)
  const parsed = rentalsReadinessSchema.safeParse(response.data)

  if (!parsed.success) {
    console.error("getRentalsReadiness Zod validation failed", {
      data: response.data,
      error: parsed.error.flatten(),
      issues: parsed.error.issues,
    })
    throw new Error(i18n.t("apiErrors.invalidPayload"))
  }

  return parsed.data
}
