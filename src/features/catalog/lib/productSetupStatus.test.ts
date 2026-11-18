import { describe, expect, it } from "vitest"

import { productAgendaReady, productNotApplicableSteps } from "./productSetupStatus"

describe("productAgendaReady", () => {
  it("needs a linked resource only when rentals is active and the product uses the schedule", () => {
    expect(productAgendaReady(true, true, 0)).toBe(false)
    expect(productAgendaReady(true, true, 1)).toBe(true)
    expect(productAgendaReady(false, true, 0)).toBe(true)
  })

  it("ignores the agenda when the product does not use the schedule", () => {
    expect(productAgendaReady(true, false, 0)).toBe(true)
  })
})

describe("productNotApplicableSteps", () => {
  it("marks Agenda and Fila only for a rentals tenant and a product without schedule", () => {
    expect(productNotApplicableSteps(false, true)).toEqual(["agenda", "fila"])
    expect(productNotApplicableSteps(true, true)).toEqual([])
    expect(productNotApplicableSteps(false, false)).toEqual([])
  })
})
