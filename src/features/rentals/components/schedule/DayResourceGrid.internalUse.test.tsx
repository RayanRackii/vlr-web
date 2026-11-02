import { render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { DayResourceGrid } from "@/features/rentals/components/schedule/DayResourceGrid"
import type { ScheduleGridOccupancy } from "@/features/rentals/components/schedule/scheduleGridModel"
import i18n from "@/lib/i18n"
import type { AdminRentalAsset } from "@/features/rentals/services/scheduleService"

const ASSET_ID = "11111111-1111-4111-8111-111111111111"

function asset(): AdminRentalAsset {
  return {
    id: ASSET_ID,
    assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
    name: "Sala 1",
    isActive: true,
    requiresDeposit: false,
    schedulePolicy: "SlotGrid",
    openTime: "08:00:00",
    closeTime: "14:00:00",
    allowedDurationMinutes: "60",
    unitId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    type: "Location",
    totalQuantity: 1,
    queueEnabled: false,
    queueOpeningTime: null,
    categoryId: null,
    categoryName: null,
  }
}

function renderGrid(occupancies: ScheduleGridOccupancy[]) {
  return render(
    <DayResourceGrid
      assets={[asset()]}
      occupancies={occupancies}
      busyTargetKey={null}
      readOnly={false}
      onCellClick={() => undefined}
    />,
  )
}

const internalUse: ScheduleGridOccupancy = {
  id: "occ-internal",
  rentalAssetId: ASSET_ID,
  startTime: "09:00:00",
  endTime: "11:00:00",
  occupancyKindLabel: "Reservado",
  occupancyKindKey: "internal",
  status: "unavailable",
  isInternalUseOrigin: true,
  workStartTime: "09:30:00",
  workEndTime: "10:30:00",
}

describe("DayResourceGrid internal-use cells", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("shows a generic 'Uso interno' badge instead of a customer name", () => {
    renderGrid([{ ...internalUse, customerName: "Cliente X", label: null }])

    expect(screen.getByText("Uso interno")).toBeInTheDocument()
    expect(screen.queryByText(/Cliente X/)).not.toBeInTheDocument()
  })

  it("renders hatched prep/cleanup buffer shades and names them accessibly", () => {
    const { container } = renderGrid([internalUse])

    const shades = container.querySelectorAll(
      '[style*="repeating-linear-gradient"]',
    )
    expect(shades.length).toBeGreaterThanOrEqual(2)

    const card = screen.getByRole("button", { name: /Uso interno/ })
    expect(card.getAttribute("aria-label")).toContain("Preparação")
    expect(card.getAttribute("aria-label")).toContain("Limpeza")
  })

  it("does not render buffer shades on an ordinary booked cell", () => {
    const { container } = renderGrid([
      {
        id: "occ-booked",
        rentalAssetId: ASSET_ID,
        startTime: "09:00:00",
        endTime: "10:00:00",
        occupancyKindLabel: "Reservado",
        status: "booked",
        customerName: "Ana",
        label: "Ana",
      },
    ])

    expect(screen.queryByText("Uso interno")).not.toBeInTheDocument()
    expect(
      container.querySelectorAll('[style*="repeating-linear-gradient"]'),
    ).toHaveLength(0)
  })
})
