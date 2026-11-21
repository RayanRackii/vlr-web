import type {
  PutTenantSubscriptionRequest,
  TenantSubscription,
} from "@/features/billing/schemas/billingSchemas"

export type SubscriptionFormState = {
  planCatalogId: string
  billingCycle: string
  status: string
  billingMode: string
  limitsUnlimited: boolean
  discountPercent: string
  discountUntil: string
  coupon: string
}

export function toFormState(subscription: TenantSubscription): SubscriptionFormState {
  return {
    planCatalogId: subscription.planCatalogId ?? "",
    billingCycle: subscription.billingCycle ?? "monthly",
    status: subscription.status ?? "trialing",
    billingMode: subscription.billingMode ?? "provider",
    limitsUnlimited: subscription.limitsUnlimited,
    discountPercent: String(subscription.discountPercent),
    discountUntil: subscription.discountUntil?.slice(0, 10) ?? "",
    coupon: "",
  }
}

/** Only the fields the admin changed, so an untouched field is never overwritten. */
export function buildSubscriptionRequest(
  subscription: TenantSubscription,
  form: SubscriptionFormState,
): PutTenantSubscriptionRequest {
  const initial = toFormState(subscription)
  const request: PutTenantSubscriptionRequest = {}

  if (form.planCatalogId !== initial.planCatalogId && form.planCatalogId !== "") {
    request.planCatalogId = form.planCatalogId
  }
  if (form.billingCycle !== initial.billingCycle) {
    request.billingCycle = form.billingCycle
  }
  if (form.status !== initial.status) {
    request.status = form.status
  }
  if (form.billingMode !== initial.billingMode) {
    request.billingMode = form.billingMode
  }
  if (form.limitsUnlimited !== initial.limitsUnlimited) {
    request.limitsUnlimited = form.limitsUnlimited
  }
  if (form.discountPercent !== initial.discountPercent) {
    const parsed = Number.parseInt(form.discountPercent, 10)
    request.discountPercent = Number.isNaN(parsed)
      ? 0
      : Math.min(100, Math.max(0, parsed))
  }
  if (form.discountUntil !== initial.discountUntil && form.discountUntil !== "") {
    request.discountUntil = `${form.discountUntil}T00:00:00Z`
  }
  const coupon = form.coupon.trim()
  if (coupon.length > 0) {
    request.coupon = coupon
  }
  return request
}
