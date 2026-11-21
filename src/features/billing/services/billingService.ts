import {
  billingSummarySchema,
  parsePublicPlans,
  tenantSubscriptionSchema,
  type BillingSummary,
  type PublicPlan,
  type PutTenantSubscriptionRequest,
  type TenantSubscription,
} from "@/features/billing/schemas/billingSchemas"
import { api, getAxiosErrorPayload, parseApiError, publicApi } from "@/lib/api"
import i18n from "@/lib/i18n"

/** Anonymous read of the active plan catalog (landing, pricing page, onboarding). */
export async function getPublicPlans(): Promise<PublicPlan[]> {
  const response = await publicApi.get<unknown>("/api/public/plans")
  return parsePublicPlans(response.data)
}

export async function getTenantSubscription(
  tenantId: string,
): Promise<TenantSubscription> {
  const response = await api.get<unknown>(
    `/api/admin/tenants/${tenantId}/subscription`,
  )
  return tenantSubscriptionSchema.parse(response.data)
}

export async function putTenantSubscription(
  tenantId: string,
  request: PutTenantSubscriptionRequest,
): Promise<TenantSubscription> {
  try {
    const response = await api.put<unknown>(
      `/api/admin/tenants/${tenantId}/subscription`,
      request,
    )
    return tenantSubscriptionSchema.parse(response.data)
  } catch (error: unknown) {
    throw new Error(
      parseApiError(
        getAxiosErrorPayload(error),
        i18n.t("admin.subscription.errors.saveFailed"),
      ),
      { cause: error },
    )
  }
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const response = await api.get<unknown>("/api/admin/billing/summary")
  return billingSummarySchema.parse(response.data)
}
