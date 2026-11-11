import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeAll, describe, expect, it } from "vitest"

import { DaySlotSheet } from "@/features/rentals/components/schedule/DaySlotSheet"
import type { DayResourceGridCellPayload } from "@/features/rentals/components/schedule/DayResourceGrid"
import i18n from "@/lib/i18n"
import type { AdminDaySlot } from "@/features/rentals/services/scheduleService"

const ASSET_ID = "11111111-1111-4111-8111-111111111111"
const ORDER_ID = "22222222-2222-4222-8222-222222222222"

function internalSlot(overrides: Partial<AdminDaySlot> = {}): AdminDaySlot {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    rentalAssetId: ASSET_ID,
    assetName: "Sala 1",
    date: "2026-11-02",
    startTime: "09:00:00",
    endTime: "11:00:00",
    occupancyKindId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    occupancyKindKey: "internal",
    occupancyKindLabel: "Reservado",
    isBookableByCustomer: false,
    label: null,
    status: "Cancelled",
    reservationId: null,
    isDerived: false,
    source: "WeeklyDefault",
    schedulePolicy: "SlotGrid",
    supportsEntireRecurrence: false,
    isInternalUseOrigin: true,
    owningCatalogOrderId: ORDER_ID,
    workStartTime: "09:30:00",
    workEndTime: "10:30:00",
    ...overrides,
  }
}

function target(slot: AdminDaySlot): DayResourceGridCellPayload {
  return {
    rentalAssetId: ASSET_ID,
    assetName: "Sala 1",
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    occupancy: null,
    slot,
  }
}

function renderSheet(slot: AdminDaySlot) {
  return render(
    <MemoryRouter>
      <DaySlotSheet
        open
        onOpenChange={() => undefined}
        target={target(slot)}
        kinds={[]}
        defaultKindId=""
        busy={false}
        busyAction={null}
        readOnly={false}
        onSave={async () => true}
        onMakeUnavailable={async () => true}
        onRestoreWeeklyDefault={async () => true}
      />
    </MemoryRouter>,
  )
}

describe("DaySlotSheet internal-use cells", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("pt-BR")
  })

  it("shows the work window and prep/cleanup buffers", () => {
    renderSheet(internalSlot())

    expect(screen.getByText("Uso interno")).toBeInTheDocument()
    expect(screen.getByText(/09:30–10:30/)).toBeInTheDocument()
    expect(screen.getByText(/09:00–09:30/)).toBeInTheDocument()
    expect(screen.getByText(/10:30–11:00/)).toBeInTheDocument()
  })

  it("links to the staff order detail route when the order id is present", () => {
    renderSheet(internalSlot())

    const link = screen.getByRole("link", { name: "Ver pedido" })
    expect(link).toHaveAttribute("href", `/pedidos/${ORDER_ID}`)
  })

  it("falls back to a neutral message without the order link when permission is missing", () => {
    renderSheet(internalSlot({ owningCatalogOrderId: null }))

    expect(screen.queryByRole("link", { name: "Ver pedido" })).not.toBeInTheDocument()
    expect(screen.getByText("Vinculado a um pedido")).toBeInTheDocument()
  })

  it("offers no customer actions on an internal-use cell", () => {
    renderSheet(internalSlot())

    expect(
      screen.queryByRole("button", { name: i18n.t("rentals.schedule.occurrence.makeUnavailable") }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: i18n.t("common.save") }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("common.close") }),
    ).toBeInTheDocument()
  })
})
