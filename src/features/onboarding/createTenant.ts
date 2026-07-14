import {
  createTenantRequestSchema,
  createTenantResponseSchema,
  parseApiError,
  type CreateTenantRequest,
  type CreateTenantResponse,
} from "@/features/onboarding/createTenantSchema"
import { api, getAxiosErrorPayload, isAxiosError } from "@/lib/api"

export async function createTenant(
  payload: CreateTenantRequest,
): Promise<CreateTenantResponse> {
  const validatedPayload = createTenantRequestSchema.parse(payload)

  try {
    const response = await api.post<unknown>("/api/onboarding/tenants", {
      ...validatedPayload,
      tradeName: validatedPayload.tradeName || null,
      headquartersUnitCode: validatedPayload.headquartersUnitCode || null,
    })

    const parsedResponse = createTenantResponseSchema.safeParse(response.data)

    if (!parsedResponse.success) {
      throw new Error("Resposta inválida da API.")
    }

    return parsedResponse.data
  } catch (error: unknown) {
    if (error instanceof Error && !(isAxiosError(error))) {
      throw error
    }

    throw new Error(parseApiError(getAxiosErrorPayload(error)))
  }
}
