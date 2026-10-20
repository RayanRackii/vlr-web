import { z } from "zod"

export const orderCancellationStatuses = ["Requested", "Approved", "Preparing", "Ready"] as const
export const orderCancellationStatusSchema = z.enum(orderCancellationStatuses)
export const catalogPolicySchema = z.object({
  customerCanCancelOrders: z.boolean(),
  orderCancelableUpToStatus: orderCancellationStatusSchema,
  customerCanCancelRequests: z.boolean(),
  requestCancelableUpToStatus: z.literal("Submitted"),
  cancellationPolicyText: z.string().max(2000).nullable(),
})
export type CatalogPolicy = z.infer<typeof catalogPolicySchema>
export const catalogPolicyFormSchema = catalogPolicySchema.extend({
  cancellationPolicyText: z.string().max(2000),
})
export type CatalogPolicyFormValues = z.infer<typeof catalogPolicyFormSchema>
export const portalCatalogPolicySchema = z.object({
  canCancelOrders: z.boolean(),
  canCancelRequests: z.boolean(),
  upToStatus: z.object({
    orders: orderCancellationStatusSchema,
    requests: z.literal("Submitted"),
  }),
  policyText: z.string().max(2000).nullable(),
})
export type PortalCatalogPolicy = z.infer<typeof portalCatalogPolicySchema>

export function canCancelCatalogItem(policy: PortalCatalogPolicy, kind: "orders" | "requests", status: string): boolean {
  if (kind === "requests") return policy.canCancelRequests && status === "Submitted"
  const current = orderCancellationStatuses.findIndex((value) => value === status)
  const limit = orderCancellationStatuses.indexOf(policy.upToStatus.orders)
  return policy.canCancelOrders && current >= 0 && current <= limit
}
