import { describe, expect, it } from "vitest"
import type { PlanningAllocation } from "../schemas/planningSchemas"
import { allocationActions, canCloseAssets, canCreateAllocation, planningPermissions as P } from "./allocationActions"

const allocation = (over: Partial<PlanningAllocation> = {}): PlanningAllocation => ({
  id: "x1", assetId: "a1", assetName: "Impressora", unitId: "u", kind: "Use", title: "Peça", notes: "", quantity: 1,
  plannedWorkStart: "2026-11-18T12:00:00.000Z", plannedWorkEnd: "2026-11-18T13:00:00.000Z",
  occupiedStart: "2026-11-18T12:00:00.000Z", occupiedEnd: "2026-11-18T13:00:00.000Z",
  timeZoneId: "UTC", status: "Scheduled", source: "Manual", referenceLabel: "", createdByUserId: "tech-1", cancelReason: "",
  actualStartAt: null, actualWorkFinishedAt: null, actualReleaseAt: null, isBlocking: true, isExpired: false, isOverdue: false, version: "v", ...over,
})

const grant = (...keys: string[]) => (key: string) => keys.includes(key)
const technician = grant(P.read, P.execute)
const admin = grant(P.read, P.manage, P.execute, P.availability)
const reader = grant(P.read)

describe("who can create", () => {
  it("lets a technician and an admin create, not a reader", () => {
    expect(canCreateAllocation(technician)).toBe(true)
    expect(canCreateAllocation(admin)).toBe(true)
    expect(canCreateAllocation(reader)).toBe(false)
  })

  it("keeps Unavailable blocks admin-level", () => {
    expect(canCloseAssets(technician)).toBe(false)
    expect(canCloseAssets(admin)).toBe(true)
    expect(canCloseAssets(grant(P.availability))).toBe(true)
    expect(canCloseAssets(grant(P.manage))).toBe(true)
  })
})

describe("technician", () => {
  it("starts a scheduled allocation but cannot edit it", () => {
    expect(allocationActions(allocation(), technician, "tech-1")).toMatchObject({ start: true, edit: false, workFinished: false, release: false })
  })

  it("finishes work while running and releases while cleaning", () => {
    expect(allocationActions(allocation({ status: "Running" }), technician, "tech-1")).toMatchObject({ start: false, workFinished: true, release: false, cancel: false })
    expect(allocationActions(allocation({ status: "Cleaning" }), technician, "tech-1")).toMatchObject({ workFinished: false, release: true })
  })

  it("cancels only an allocation they created", () => {
    expect(allocationActions(allocation({ createdByUserId: "tech-1" }), technician, "tech-1").cancel).toBe(true)
    expect(allocationActions(allocation({ createdByUserId: "someone-else" }), technician, "tech-1").cancel).toBe(false)
    expect(allocationActions(allocation({ createdByUserId: null }), technician, "tech-1").cancel).toBe(false)
    expect(allocationActions(allocation(), technician, null).cancel).toBe(false)
  })

  it("cannot run or edit an Unavailable block", () => {
    const block = allocation({ kind: "Unavailable" })
    expect(allocationActions(block, technician, "tech-1")).toMatchObject({ start: false, edit: false })
    expect(allocationActions(allocation({ kind: "Unavailable", status: "Running" }), technician, "tech-1")).toMatchObject({ workFinished: false })
    expect(allocationActions(allocation({ kind: "Unavailable", status: "Cleaning" }), technician, "tech-1")).toMatchObject({ release: false })
  })

  it("may still cancel an Unavailable block they created", () => {
    expect(allocationActions(allocation({ kind: "Unavailable", createdByUserId: "tech-1" }), technician, "tech-1").cancel).toBe(true)
  })
})

describe("admin", () => {
  it("edits, starts and cancels any scheduled allocation", () => {
    expect(allocationActions(allocation({ createdByUserId: "someone-else" }), admin, "admin-1")).toMatchObject({ edit: true, start: true, cancel: true })
  })

  it("runs an Unavailable block", () => {
    expect(allocationActions(allocation({ kind: "Unavailable" }), admin, "admin-1")).toMatchObject({ edit: true, start: true })
  })
})

describe("states", () => {
  it("offers nothing on a finished allocation", () => {
    for (const status of ["Released", "Cancelled"]) {
      expect(allocationActions(allocation({ status }), admin, "admin-1")).toEqual({ edit: false, start: false, workFinished: false, release: false, cancel: false, orderWorkflow: false })
    }
  })

  it("cannot start or edit an expired allocation, but may cancel it", () => {
    expect(allocationActions(allocation({ isExpired: true }), admin, "admin-1")).toMatchObject({ start: false, edit: false, cancel: true })
  })

  it("cannot cancel once started", () => {
    expect(allocationActions(allocation({ status: "Running" }), admin, "admin-1").cancel).toBe(false)
  })

  it("shows no actions to a reader", () => {
    expect(allocationActions(allocation(), reader, "r-1")).toEqual({ edit: false, start: false, workFinished: false, release: false, cancel: false, orderWorkflow: false })
  })

  it("leaves order-owned allocations to the order flow", () => {
    const actions = allocationActions(allocation({ source: "CatalogOrder", referenceLabel: "Pedido 12" }), admin, "admin-1")
    expect(actions).toEqual({ edit: false, start: false, workFinished: false, release: false, cancel: false, orderWorkflow: true })
    expect(allocationActions(allocation({ source: "WorkOrder" }), admin, "admin-1").orderWorkflow).toBe(true)
  })
})
