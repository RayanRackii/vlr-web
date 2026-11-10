import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { DaySlotSheet } from "@/features/rentals/components/schedule/DaySlotSheet"
import type { DayResourceGridCellPayload } from "@/features/rentals/components/schedule/DayResourceGrid"
import type { AdminDaySlot, OccupancyKind } from "@/features/rentals/services/scheduleService"
import i18n from "@/lib/i18n"

const KIND: OccupancyKind = {
  id: "kind-1",
  key: "available",
  label: "Disponível",
  isActive: true,
  isBookableByCustomer: true,
  blocksCapacity: true,
  sortOrder: 0,
}

const SLOT: AdminDaySlot = {
  id: "slot-1",
  rentalAssetId: "asset-1",
  assetName: "Sala 1",
  date: "2026-11-02",
  startTime: "09:00:00",
  endTime: "10:00:00",
  occupancyKindId: KIND.id,
  occupancyKindKey: KIND.key,
  occupancyKindLabel: KIND.label,
  isBookableByCustomer: true,
  label: "",
  status: "Open",
  reservationId: null,
  isDerived: false,
  source: "WeeklyDefault",
  schedulePolicy: "SlotGrid",
  supportsEntireRecurrence: true,
  isInternalUseOrigin: false,
  owningCatalogOrderId: null,
  workStartTime: null,
  workEndTime: null,
}

const TARGET: DayResourceGridCellPayload = {
  rentalAssetId: "asset-1",
  assetName: "Sala 1",
  startTime: "09:00:00",
  endTime: "10:00:00",
  occupancy: null,
  date: "2026-11-02",
  slot: SLOT,
}

describe("DaySlotSheet leave", () => {
  it("treats a label change as dirty and asks on collapse, while cancel discards", async () => {
    const user = userEvent.setup()
    const onDirtyChange = vi.fn()
    const onRequestClose = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <MemoryRouter>
        <DaySlotSheet
          open
          onOpenChange={onOpenChange}
          onDirtyChange={onDirtyChange}
          onRequestClose={onRequestClose}
          target={TARGET}
          kinds={[KIND]}
          defaultKindId={KIND.id}
          busy={false}
          busyAction={null}
          readOnly={false}
          onSave={async () => true}
          onMakeUnavailable={async () => true}
          onRestoreWeeklyDefault={async () => true}
        />
      </MemoryRouter>,
    )

    await user.type(
      screen.getByLabelText(i18n.t("rentals.schedule.templates.label")),
      "Manhã",
    )
    await waitFor(() => expect(onDirtyChange).toHaveBeenCalledWith(true))

    await user.click(screen.getByRole("button", { name: i18n.t("rentals.schedule.occurrence.editTitle") }))
    expect(onRequestClose).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: i18n.t("common.cancel") }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onRequestClose).toHaveBeenCalledOnce()
  })
})
