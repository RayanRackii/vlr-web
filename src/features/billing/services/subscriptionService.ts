import {
  checkoutResultSchema,
  parseBillingPlans,
  tenantBillingSubscriptionSchema,
  type BillingPlansResult,
  type CheckoutMethod,
  type CheckoutResult,
  type TenantBillingSubscription,
} from "@/features/billing/schemas/subscriptionSchemas"
import type { BillingCycle } from "@/features/billing/lib/planCatalog"
import { api } from "@/lib/api"
import { idempotencyHeaders, retryWhileInProgress } from "@/lib/idempotency"

export async function getMySubscription(): Promise<TenantBillingSubscription> {
  const response = await api.get<unknown>("/api/billing/subscription")
  return tenantBillingSubscriptionSchema.parse(response.data)
}

export async function getBillingPlans(): Promise<BillingPlansResult> {
  const response = await api.get<unknown>("/api/billing/plans")
  return parseBillingPlans(response.data)
}

export type CheckoutRequest = {
  planCatalogId: string
  billingCycle: BillingCycle
  method: CheckoutMethod
}

export async function startCheckout(
  request: CheckoutRequest,
  idempotencyKey: string,
): Promise<CheckoutResult> {
  const headers = idempotencyHeaders(idempotencyKey)
  const response = await retryWhileInProgress(() =>
    api.post<unknown>("/api/billing/subscription/checkout", request, { headers }),
  )
  return checkoutResultSchema.parse(response.data)
}

export async function changePlan(request: {
  planCatalogId: string
  billingCycle: BillingCycle
}): Promise<TenantBillingSubscription> {
  const response = await api.post<unknown>("/api/billing/subscription/change-plan", request)
  return tenantBillingSubscriptionSchema.parse(response.data)
}

export async function cancelSubscription(): Promise<TenantBillingSubscription> {
  const response = await api.post<unknown>("/api/billing/subscription/cancel")
  return tenantBillingSubscriptionSchema.parse(response.data)
}
