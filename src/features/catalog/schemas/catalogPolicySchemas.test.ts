import { describe, expect, it } from "vitest"
import { canCancelCatalogItem, catalogPolicySchema, orderCancellationStatuses, portalCatalogPolicySchema, type PortalCatalogPolicy } from "./catalogPolicySchemas"

const policy: PortalCatalogPolicy = { canCancelOrders: true, canCancelRequests: true, upToStatus: { orders: "Requested", requests: "Submitted" }, policyText: null }

describe("catalog cancellation policy", () => {
  for (const [limitIndex, limit] of orderCancellationStatuses.entries()) {
    it(`allows order states through ${limit} inclusively`, () => {
      const current = { ...policy, upToStatus: { ...policy.upToStatus, orders: limit } }
      for (const [index, status] of orderCancellationStatuses.entries()) expect(canCancelCatalogItem(current, "orders", status)).toBe(index <= limitIndex)
      for (const status of ["Completed", "Rejected", "Cancelled", "FutureStatus"]) expect(canCancelCatalogItem(current, "orders", status)).toBe(false)
    })
  }
  it("honors disabled flags and only allows Submitted requests", () => {
    expect(canCancelCatalogItem({ ...policy, canCancelOrders: false }, "orders", "Requested")).toBe(false)
    expect(canCancelCatalogItem({ ...policy, canCancelRequests: false }, "requests", "Submitted")).toBe(false)
    expect(canCancelCatalogItem(policy, "requests", "Submitted")).toBe(true)
    for (const status of ["Cancelled", "Quoted", "Approved"]) expect(canCancelCatalogItem(policy, "requests", status)).toBe(false)
  })
  it("validates the complete admin contract and text limit", () => {
    const admin = { customerCanCancelOrders: true, customerCanCancelRequests: false, orderCancelableUpToStatus: "Requested", requestCancelableUpToStatus: "Submitted", cancellationPolicyText: "x".repeat(2000) }
    expect(catalogPolicySchema.safeParse(admin).success).toBe(true)
    expect(catalogPolicySchema.safeParse({ ...admin, cancellationPolicyText: "x".repeat(2001) }).success).toBe(false)
    expect(catalogPolicySchema.safeParse({ ...admin, orderCancelableUpToStatus: "Completed" }).success).toBe(false)
    expect(catalogPolicySchema.safeParse({ ...admin, customerCanCancelRequests: undefined }).success).toBe(false)
    expect(portalCatalogPolicySchema.safeParse({ ...policy, upToStatus: { orders: "Ready", requests: "Cancelled" } }).success).toBe(false)
  })
})
