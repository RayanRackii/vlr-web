import { describe, expect, it } from "vitest"

import { allocationAgendaLink, type OrderAllocation } from "./orderAllocationUsage"

const base = {
  id: "a",
  requirementId: "r",
  status: "Scheduled",
  plannedWorkStart: "2026-11-26T15:00:00Z",
  plannedWorkEnd: "2026-11-26T16:00:00Z",
  timeZoneId: "America/Sao_Paulo",
  actualStartAt: null,
  actualWorkFinishedAt: null,
  actualReleaseAt: null,
  planningRevision: 1,
} as const

const rentalBacked = { ...base, rentalAssetId: "rental-1", assetId: "asset-1" } as OrderAllocation
const planningOnly = { ...base, rentalAssetId: null, assetId: "asset-1" } as OrderAllocation
const canOnly = (...granted: string[]) => (permission: string) => granted.includes(permission)

describe("allocationAgendaLink", () => {
  it("links the rentals agenda for a rental-backed allocation, gated by rentals.schedule.read", () => {
    expect(allocationAgendaLink(rentalBacked, canOnly("rentals.schedule.read"))).toBe("/agendas/recursos?date=2026-11-26")
    expect(allocationAgendaLink(rentalBacked, canOnly("resource-planning.agenda.read"))).toBeNull()
  })

  it("links the planning agenda for a planning-only allocation, gated by resource-planning.agenda.read", () => {
    expect(allocationAgendaLink(planningOnly, canOnly("resource-planning.agenda.read"))).toBe("/agendas/planejamento?date=2026-11-26")
    expect(allocationAgendaLink(planningOnly, canOnly("rentals.schedule.read"))).toBeNull()
  })

  it("has no link without an allocation", () => {
    expect(allocationAgendaLink(null, () => true)).toBeNull()
  })
})
