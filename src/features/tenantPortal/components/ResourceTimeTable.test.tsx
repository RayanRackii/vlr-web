import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ResourceTimeTable } from "@/features/tenantPortal/components/ResourceTimeTable"
import type { PortalDailyAvailability } from "@/features/tenantPortal/services/tenantPortalService"

const availability: PortalDailyAvailability = {
  date: "2026-10-21",
  timeZone: "America/Sao_Paulo",
  serverNow: "2026-10-21T12:00:00+00:00",
  quoteExpiresAt: "2026-10-21T12:01:00+00:00",
  currency: "BRL",
  resources: [
    {
      rentalAssetId: "00000000-0000-4000-8000-000000000001",
      assetId: "00000000-0000-4000-8000-000000000011",
      unitId: "00000000-0000-4000-8000-000000000021",
      name: "Bola",
      type: "Good",
      totalQuantity: 5,
      requiresDeposit: false,
      queueEnabled: false,
      effectiveMaxAdvanceBookingDays: null,
      windows: [
        { slotId: null, startTime: "10:00:00", endTime: "11:00:00", isDerived: true, state: "Available", reasonCode: null, availableQuantity: 5, totalAmount: 0 },
        { slotId: null, startTime: "11:00:00", endTime: "12:00:00", isDerived: true, state: "Past", reasonCode: "START_IN_THE_PAST", availableQuantity: 5, totalAmount: 10 },
      ],
    },
    {
      rentalAssetId: "00000000-0000-4000-8000-000000000002",
      assetId: "00000000-0000-4000-8000-000000000012",
      unitId: "00000000-0000-4000-8000-000000000022",
      name: "Quadra", type: "Location", totalQuantity: 1, requiresDeposit: false, queueEnabled: true, effectiveMaxAdvanceBookingDays: 0,
      windows: [
        { slotId: null, startTime: "10:00:00", endTime: "11:00:00", isDerived: true, state: "Taken", reasonCode: "INSUFFICIENT_CAPACITY", availableQuantity: 0, totalAmount: 20 },
        { slotId: null, startTime: "11:00:00", endTime: "12:00:00", isDerived: true, state: "OutsideHorizon", reasonCode: "booking_horizon_exceeded", availableQuantity: 1, totalAmount: null },
      ],
    },
  ],
}

describe("ResourceTimeTable", () => {
  it("shows free counts, distinct unavailable states, queue access, and stock quantity", () => {
    const onSelect = vi.fn()
    const onQuantityChange = vi.fn()
    const onViewQueue = vi.fn()
    render(<ResourceTimeTable availability={availability} locale="en" selection={{ rentalAssetId: availability.resources[0]!.rentalAssetId, startTime: "10:00:00", endTime: "11:00:00", quantity: 2 }} onSelect={onSelect} onQuantityChange={onQuantityChange} onViewQueue={onViewQueue} />)

    expect(screen.getByText("10:00 · 1 livre")).toBeInTheDocument()
    expect(screen.getByText("Encerrado")).toBeInTheDocument()
    expect(screen.getByText("Fora do prazo")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver fila" }))
    expect(onViewQueue).toHaveBeenCalledWith(availability.resources[1]!.rentalAssetId)
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantidade de Bola" }), { target: { value: "3" } })
    expect(onQuantityChange).toHaveBeenCalledWith(3)
    fireEvent.click(screen.getByRole("button", { name: /Bola.*Disponível/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }))
  })
})
