import i18n from "@/lib/i18n"
import { api, getAxiosErrorPayload, isAxiosError, parseApiError } from "@/lib/api"
import {
  registryCategoryListSchema,
  type RegistryCategoryListItem,
} from "@/features/pmoc/schemas/registryCategorySchemas"

export async function listPlanAssetCategories(): Promise<
  RegistryCategoryListItem[]
> {
  try {
    const response = await api.get<unknown>(
      "/api/maintenance-plans/asset-categories",
    )
    const parsed = registryCategoryListSchema.safeParse(response.data)

    if (!parsed.success) {
      throw new Error(i18n.t("pmoc.plans.errors.invalidResponse"))
    }

    return parsed.data
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("pmoc.create.errors.loadLookupsFailed"),
      ),
    )
  }
}
