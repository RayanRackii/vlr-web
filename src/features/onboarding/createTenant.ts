import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  parseApiError,
  type CreateTenantRequest,
  type CreateTenantResponse,
} from "@/features/onboarding/createTenantSchema"
import i18n from "@/lib/i18n"
import { publicApi, getAxiosErrorPayload, isAxiosError } from "@/lib/api"

export async function createTenant(
  payload: CreateTenantRequest,
): Promise<CreateTenantResponse> {
  const validatedPayload = createTenantRequestSchema.parse(payload)

  try {
    const response = await publicApi.post<unknown>("/api/onboarding/tenants", {
      legalName: validatedPayload.legalName,
      taxId: validatedPayload.taxId,
      tradeName: validatedPayload.tradeName || null,
      headquartersUnitName: validatedPayload.headquartersUnitName,
      headquartersUnitCode: validatedPayload.headquartersUnitCode || null,
      adminFullName: validatedPayload.adminFullName,
      adminEmail: validatedPayload.adminEmail,
      adminPhone: validatedPayload.adminPhone,
      isTrial: true,
    })

    const parsedResponse = createTenantResponseSchema.safeParse(response.data)

    if (!parsedResponse.success) {
      throw new Error(i18n.t("trial.onboarding.errors.failed"))
    }

    return parsedResponse.data
  } catch (error: unknown) {
    if (error instanceof Error && !isAxiosError(error)) {
      throw error
    }

    throw new Error(parseApiError(getAxiosErrorPayload(error)))
  }
}
